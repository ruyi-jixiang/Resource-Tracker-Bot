const { Client, GatewayIntentBits, Events } = require('discord.js');
const { GoogleSpreadsheet } = require('google-spreadsheet');
const { JWT } = require('google-auth-library');

const LOG_CHANNEL_ID = '1507988343281942618'; // The single channel for both items and gear
const ANNOUNCEMENT_CHANNEL_ID = '1507588311374495834'; 
const SPREADSHEET_ID = '1gX6WECCSj0D_QJY0j06BFT6RMYVCrgG1-VUgw9fIVCE';
// ------------------------------

const creds = process.env.GOOGLE_CREDS 
  ? JSON.parse(process.env.GOOGLE_CREDS) 
  : require('./credentials.json');

const token = process.env.DISCORD_TOKEN;

const serviceAccountAuth = new JWT({
  email: creds.client_email,
  key: creds.private_key,
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

const doc = new GoogleSpreadsheet(SPREADSHEET_ID, serviceAccountAuth);

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds, 
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers 
  ]
});

client.once(Events.ClientReady, (c) => {
  console.log(`✅ Production Tracker Bot ONLINE as ${c.user.tag}`);
});

// Helper to normalize strings for robust item column matching
function cleanKey(str) {
    if (!str) return '';
    let normalized = String(str).toLowerCase().trim();
    
    // Protects "sticks" and "stones" from losing their trailing 's'
    if (normalized.endsWith('s') && normalized !== 'sticks' && normalized !== 'stones') {
        normalized = normalized.slice(0, -1);
    }
    return normalized.replace(/\s+/g, '');
}

// Helper processor to handle a specific sheet update (Resources or Equipment)
async function processSheetUpdate({ sheetIndex, itemsToScan, robloxUsername, message, displayName, modeText }) {
    const activeUpdates = itemsToScan.filter(item => item.qty !== 0);
    if (activeUpdates.length === 0) return false; 

    const sheet = doc.sheetsByIndex[sheetIndex]; 
    if (!sheet) {
        console.error(`❌ Tab at Index ${sheetIndex} could not be verified.`);
        await message.react('⚠️');
        return false;
    }

    const maxRows = sheet.rowCount;
    const maxCols = sheet.columnCount;

    await sheet.loadCells({ 
        startRowIndex: 0, 
        endRowIndex: maxRows, 
        startColumnIndex: 0, 
        endColumnIndex: maxCols 
    }); 

    // Dynamic Header Scanner (Row 9 -> Index 8)
    const columnMap = {};
    for (let c = 0; c < maxCols; c++) {
        const headerValue = sheet.getCell(8, c).value;
        if (headerValue) {
            const cleanedHeader = cleanKey(headerValue);
            columnMap[cleanedHeader] = c;
        }
    }

    const finalizedUpdates = [];
    for (const item of activeUpdates) {
        const lookUpKey = cleanKey(item.key);
        if (columnMap[lookUpKey] !== undefined) {
            finalizedUpdates.push({ ...item, col: columnMap[lookUpKey] });
        } else {
            console.warn(`⚠️ Layout notice: Could not map column header for "${item.key}" on sheet index ${sheetIndex}`);
        }
    }

    if (finalizedUpdates.length === 0) return false;

    // User Row Locator (Column C -> Index 2)
    let playerRowIndex = -1;
    for (let r = 9; r < maxRows; r++) { 
        const cell = sheet.getCell(r, 2); 
        if (cell && cell.value && String(cell.value).trim().toLowerCase() === robloxUsername) {
            playerRowIndex = r;
            break;
        }
    }

    if (playerRowIndex === -1) {
        console.error(`❌ Could not locate player row for username: "${robloxUsername}" on sheet index ${sheetIndex}`);
        await message.react('❓'); 
        return false;
    }

    let isNegativeUpdate = false;

    // STEP 1: Apply individual player changes locally
    finalizedUpdates.forEach(item => {
        if (item.qty < 0) isNegativeUpdate = true;

        const playerCell = sheet.getCell(playerRowIndex, item.col);
        const playerCurrent = parseInt(playerCell.value, 10) || 0;
        playerCell.value = playerCurrent + item.qty;
    });

    // STEP 2: Save individual rows first
    await sheet.saveUpdatedCells();

    // STEP 3: Reload information to clear transaction states cleanly
    await sheet.loadCells({ 
        startRowIndex: 0, 
        endRowIndex: maxRows, 
        startColumnIndex: 0, 
        endColumnIndex: maxCols 
    });

    // STEP 4: Run the safe math summation loop
    finalizedUpdates.forEach(item => {
        let calculatedSum = 0;
        
        for (let r = 9; r < maxRows; r++) {
            const playerCell = sheet.getCell(r, item.col);
            if (playerCell && playerCell.value) {
                const val = parseInt(playerCell.value, 10);
                if (!isNaN(val)) {
                    calculatedSum += val;
                }
            }
        }

        // FIXED: Both layouts have their target amounts row on Row 3 (Index 2)
        const targetGlobalRowIndex = 2; 
        
        const globalCell = sheet.getCell(targetGlobalRowIndex, item.col);
        globalCell.value = calculatedSum; 
    });

    // STEP 5: Final save for the self-healing calculation block
    await sheet.saveUpdatedCells();

    // Success Emojis
    if (modeText === "Equipment") {
        await message.react(isNegativeUpdate ? '🛡️' : '⚔️');
    } else {
        await message.react(isNegativeUpdate ? '🛠️' : '📦');
    }

    // Post Summary Announcement
    const announceChannel = client.channels.cache.get(ANNOUNCEMENT_CHANNEL_ID);
    if (announceChannel) {
        let summary = `### 📑 ${modeText} Updated by ${message.author} (${displayName.split('|')[1].trim()})\n`;
        finalizedUpdates.forEach(item => {
            const sign = item.qty > 0 ? `+${item.qty}` : `${item.qty}`;
            const pTotal = sheet.getCell(playerRowIndex, item.col).value || 0;
            summary += `• ${item.emoji} **${item.key}:** ${sign} *(Your Total: ${pTotal})*\n`;
        });
        await announceChannel.send(summary);
    }

    return true;
}

client.on(Events.MessageCreate, async (message) => {
    if (message.author.bot) return;
    if (message.channel.id !== LOG_CHANNEL_ID) return;

    const displayName = message.member ? message.member.displayName : '';
    if (!displayName.includes('|')) {
        console.log(`⚠️ ${message.author.tag} does not have a '|' in their server nickname.`);
        await message.react('⚠️');
        return;
    }
    const robloxUsername = displayName.split('|')[1].trim().toLowerCase();
    const content = message.content.toLowerCase();

    // 1. Compile Resource RegEx Matches
    const resourceMatches = {
        'Charcoal': content.match(/(-?\+?\d+)\s*x?\s*charcoal/),
        'Coal Ore': content.match(/(-?\+?\d+)\s*x?\s*coal\s*ore/),
        'Condensed Crystals': content.match(/(-?\+?\d+)\s*x?\s*condensed\s*crystals?/),
        'Copper Ingots': content.match(/(-?\+?\d+)\s*x?\s*copper\s*ingots?/),
        'Copper Ore': content.match(/(-?\+?\d+)\s*x?\s*copper\s*ore/),
        'Gel': content.match(/(-?\+?\d+)\s*x?\s*gel/),
        'Glass': content.match(/(-?\+?\d+)\s*x?\s*glass/),
        'Gold Ingots': content.match(/(-?\+?\d+)\s*x?\s*gold\s*ingots?/),
        'Gold Ore': content.match(/(-?\+?\d+)\s*x?\s*gold\s*ore/),
        'Iron': content.match(/(-?\+?\d+)\s*x?\s*iron(?!\s*(ingot|pellet))/), 
        'Iron Ingots': content.match(/(-?\+?\d+)\s*x?\s*iron\s*ingots?/),
        'Leather': content.match(/(-?\+?\d+)\s*x?\s*leather/),
        'Logs': content.match(/(-?\+?\d+)\s*x?\s*logs?/),
        'Mana Crystals': content.match(/(-?\+?\d+)\s*x?\s*mana\s*crystals?/),
        'Sandstone': content.match(/(-?\+?\d+)\s*x?\s*sandstone/),
        'Silver Ingots': content.match(/(-?\+?\d+)\s*x?\s*silver\s*ingots?/),
        'Silver Ore': content.match(/(-?\+?\d+)\s*x?\s*silver\s*ore/),
        'Sticks': content.match(/(-?\+?\d+)\s*x?\s*sticks?/),
        'Stones': content.match(/(-?\+?\d+)\s*x?\s*stones?/)
    };
    const resourceItems = [
        { key: 'Charcoal',           emoji: '⬛', qty: resourceMatches['Charcoal'] ? parseInt(resourceMatches['Charcoal'][1], 10) : 0 },
        { key: 'Coal Ore',           emoji: '🪨', qty: resourceMatches['Coal Ore'] ? parseInt(resourceMatches['Coal Ore'][1], 10) : 0 },
        { key: 'Condensed Crystals', emoji: '🔮', qty: resourceMatches['Condensed Crystals'] ? parseInt(resourceMatches['Condensed Crystals'][1], 10) : 0 },
        { key: 'Copper Ingots',      emoji: '🟧', qty: resourceMatches['Copper Ingots'] ? parseInt(resourceMatches['Copper Ingots'][1], 10) : 0 },
        { key: 'Copper Ore',         emoji: '🟫', qty: resourceMatches['Copper Ore'] ? parseInt(resourceMatches['Copper Ore'][1], 10) : 0 },
        { key: 'Gel',                emoji: '🟢', qty: resourceMatches['Gel'] ? parseInt(resourceMatches['Gel'][1], 10) : 0 },
        { key: 'Glass',              emoji: '⬜', qty: resourceMatches['Glass'] ? parseInt(resourceMatches['Glass'][1], 10) : 0 },
        { key: 'Gold Ingots',        emoji: '🟨', qty: resourceMatches['Gold Ingots'] ? parseInt(resourceMatches['Gold Ingots'][1], 10) : 0 },
        { key: 'Gold Ore',           emoji: '🟡', qty: resourceMatches['Gold Ore'] ? parseInt(resourceMatches['Gold Ore'][1], 10) : 0 },
        { key: 'Iron',               emoji: '🟥', qty: resourceMatches['Iron'] ? parseInt(resourceMatches['Iron'][1], 10) : 0 },
        { key: 'Iron Ingots',        emoji: '🔩', qty: resourceMatches['Iron Ingots'] ? parseInt(resourceMatches['Iron Ingots'][1], 10) : 0 },
        { key: 'Leather',            emoji: '🟫', qty: resourceMatches['Leather'] ? parseInt(resourceMatches['Leather'][1], 10) : 0 },
        { key: 'Logs',               emoji: '🪵', qty: resourceMatches['Logs'] ? parseInt(resourceMatches['Logs'][1], 10) : 0 },
        { key: 'Mana Crystals',      emoji: '🟦', qty: resourceMatches['Mana Crystals'] ? parseInt(resourceMatches['Mana Crystals'][1], 10) : 0 },
        { key: 'Sandstone',          emoji: '🧱', qty: resourceMatches['Sandstone'] ? parseInt(resourceMatches['Sandstone'][1], 10) : 0 },
        { key: 'Silver Ingots',      emoji: '🪙', qty: resourceMatches['Silver Ingots'] ? parseInt(resourceMatches['Silver Ingots'][1], 10) : 0 },
        { key: 'Silver Ore',         emoji: '⚪', qty: resourceMatches['Silver Ore'] ? parseInt(resourceMatches['Silver Ore'][1], 10) : 0 },
        { key: 'Sticks',             emoji: '🥢', qty: resourceMatches['Sticks'] ? parseInt(resourceMatches['Sticks'][1], 10) : 0 },
        { key: 'Stones',             emoji: '🪨', qty: resourceMatches['Stones'] ? parseInt(resourceMatches['Stones'][1], 10) : 0 }
    ];

    // 2. Compile Equipment RegEx Matches
    const equipmentMatches = {
        'Axe': content.match(/(-?\+?\d+)\s*x?\s*axe/),
        'Bandage': content.match(/(-?\+?\d+)\s*x?\s*bandage/),
        'Hammer': content.match(/(-?\+?\d+)\s*x?\s*hammer/),
        'Hexheater': content.match(/(-?\+?\d+)\s*x?\s*hexheater/),
        'Hexket': content.match(/(-?\+?\d+)\s*x?\s*hexket/),
        'Iron Pellet': content.match(/(-?\+?\d+)\s*x?\s*iron\s*pellet/),
        'Lantern': content.match(/(-?\+?\d+)\s*x?\s*lantern/),
        'Longsword': content.match(/(-?\+?\d+)\s*x?\s*longsword/),
        'Parka': content.match(/(-?\+?\d+)\s*x?\s*parka/),
        'Pickaxe': content.match(/(-?\+?\d+)\s*x?\s*pickaxe/),
        'Shield': content.match(/(-?\+?\d+)\s*x?\s*shield/),
        'Shortsword': content.match(/(-?\+?\d+)\s*x?\s*shortsword/),
        'Spear': content.match(/(-?\+?\d+)\s*x?\s*spear/)
    };
    const equipmentItems = [
        { key: 'Axe',         emoji: '🪓', qty: equipmentMatches['Axe'] ? parseInt(equipmentMatches['Axe'][1], 10) : 0 },
        { key: 'Bandage',     emoji: '🩹', qty: equipmentMatches['Bandage'] ? parseInt(equipmentMatches['Bandage'][1], 10) : 0 },
        { key: 'Hammer',      emoji: '🔨', qty: equipmentMatches['Hammer'] ? parseInt(equipmentMatches['Hammer'][1], 10) : 0 },
        { key: 'Hexheater',   emoji: '🧥', qty: equipmentMatches['Hexheater'] ? parseInt(equipmentMatches['Hexheater'][1], 10) : 0 },
        { key: 'Hexket',      emoji: '🔫', qty: equipmentMatches['Hexket'] ? parseInt(equipmentMatches['Hexket'][1], 10) : 0 },
        { key: 'Iron Pellet', emoji: '⚪', qty: equipmentMatches['Iron Pellet'] ? parseInt(equipmentMatches['Iron Pellet'][1], 10) : 0 },
        { key: 'Lantern',     emoji: '🏮', qty: equipmentMatches['Lantern'] ? parseInt(equipmentMatches['Lantern'][1], 10) : 0 },
        { key: 'Longsword',   emoji: '⚔️', qty: equipmentMatches['Longsword'] ? parseInt(equipmentMatches['Longsword'][1], 10) : 0 },
        { key: 'Parka',       emoji: '🧥', qty: equipmentMatches['Parka'] ? parseInt(equipmentMatches['Parka'][1], 10) : 0 },
        { key: 'Pickaxe',     emoji: '⛏️', qty: equipmentMatches['Pickaxe'] ? parseInt(equipmentMatches['Pickaxe'][1], 10) : 0 },
        { key: 'Shield',      emoji: '🛡️', qty: equipmentMatches['Shield'] ? parseInt(equipmentMatches['Shield'][1], 10) : 0 },
        { key: 'Shortsword',  emoji: '🗡️', qty: equipmentMatches['Shortsword'] ? parseInt(equipmentMatches['Shortsword'][1], 10) : 0 },
        { key: 'Spear',       emoji: '🔱', qty: equipmentMatches['Spear'] ? parseInt(equipmentMatches['Spear'][1], 10) : 0 }
    ];

    try {
        await doc.loadInfo();

        await processSheetUpdate({
            sheetIndex: 2,
            itemsToScan: resourceItems,
            robloxUsername,
            message,
            displayName,
            modeText: "Inventory"
        });

        await processSheetUpdate({
            sheetIndex: 3, 
            itemsToScan: equipmentItems,
            robloxUsername,
            message,
            displayName,
            modeText: "Equipment"
        });

    } catch (err) {
        console.error("Critical Runtime Error during Sheets synchronization:", err);
        try {
            await message.react('⚠️');
        } catch (reactErr) {
            console.error("Failed to append fallback error status emoji:", reactErr);
        }
    }
});

client.login(token);