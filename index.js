const { Client, GatewayIntentBits, Events } = require('discord.js');
const { GoogleSpreadsheet } = require('google-spreadsheet');
const { JWT } = require('google-auth-library');

const RESOURCE_CHANNEL_ID = '1507988343281942618'; 
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

function cleanKey(str) {
    if (!str) return '';
    let normalized = String(str).toLowerCase().trim();
    if (normalized.endsWith('s')) {
        normalized = normalized.slice(0, -1);
    }
    return normalized.replace(/\s+/g, '');
}

client.on(Events.MessageCreate, async (message) => {
    if (message.author.bot) return;
    if (message.channel.id !== RESOURCE_CHANNEL_ID) return;

    const displayName = message.member ? message.member.displayName : '';
    if (!displayName.includes('|')) {
        console.log(`⚠️ ${message.author.tag} does not have a '|' in their server nickname.`);
        await message.react('⚠️');
        return;
    }
    const robloxUsername = displayName.split('|')[1].trim().toLowerCase();

    const content = message.content.toLowerCase();

    const matches = {
        'Charcoal': content.match(/(-?\+?\d+)\s*x?\s*charcoal/),
        'Coal Ore': content.match(/(-?\+?\d+)\s*x?\s*coal\s*ore/),
        'Condensed Crystals': content.match(/(-?\+?\d+)\s*x?\s*condensed\s*crystals?/),
        'Copper Ingots': content.match(/(-?\+?\d+)\s*x?\s*copper\s*ingots?/),
        'Copper Ore': content.match(/(-?\+?\d+)\s*x?\s*copper\s*ore/),
        'Gel': content.match(/(-?\+?\d+)\s*x?\s*gel/),
        'Glass': content.match(/(-?\+?\d+)\s*x?\s*glass/),
        'Gold Ingots': content.match(/(-?\+?\d+)\s*x?\s*gold\s*ingots?/),
        'Gold Ore': content.match(/(-?\+?\d+)\s*x?\s*gold\s*ore/),
        'Iron': content.match(/(-?\+?\d+)\s*x?\s*iron(?!\s*ingot)/), 
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
        { key: 'Charcoal',           emoji: '⬛', qty: matches['Charcoal'] ? parseInt(matches['Charcoal'][1], 10) : 0 },
        { key: 'Coal Ore',           emoji: '🪨', qty: matches['Coal Ore'] ? parseInt(matches['Coal Ore'][1], 10) : 0 },
        { key: 'Condensed Crystals', emoji: '🔮', qty: matches['Condensed Crystals'] ? parseInt(matches['Condensed Crystals'][1], 10) : 0 },
        { key: 'Copper Ingots',      emoji: '🟧', qty: matches['Copper Ingots'] ? parseInt(matches['Copper Ingots'][1], 10) : 0 },
        { key: 'Copper Ore',         emoji: '🟫', qty: matches['Copper Ore'] ? parseInt(matches['Copper Ore'][1], 10) : 0 },
        { key: 'Gel',                emoji: '🟢', qty: matches['Gel'] ? parseInt(matches['Gel'][1], 10) : 0 },
        { key: 'Glass',              emoji: '⬜', qty: matches['Glass'] ? parseInt(matches['Glass'][1], 10) : 0 },
        { key: 'Gold Ingots',        emoji: '🟨', qty: matches['Gold Ingots'] ? parseInt(matches['Gold Ingots'][1], 10) : 0 },
        { key: 'Gold Ore',           emoji: '🟡', qty: matches['Gold Ore'] ? parseInt(matches['Gold Ore'][1], 10) : 0 },
        { key: 'Iron',               emoji: '🟥', qty: matches['Iron'] ? parseInt(matches['Iron'][1], 10) : 0 },
        { key: 'Iron Ingots',        emoji: '🔩', qty: matches['Iron Ingots'] ? parseInt(matches['Iron Ingots'][1], 10) : 0 },
        { key: 'Leather',            emoji: '🟫', qty: matches['Leather'] ? parseInt(matches['Leather'][1], 10) : 0 },
        { key: 'Logs',               emoji: '🪵', qty: matches['Logs'] ? parseInt(matches['Logs'][1], 10) : 0 },
        { key: 'Mana Crystals',      emoji: '🟦', qty: matches['Mana Crystals'] ? parseInt(matches['Mana Crystals'][1], 10) : 0 },
        { key: 'Sandstone',          emoji: '🧱', qty: matches['Sandstone'] ? parseInt(matches['Sandstone'][1], 10) : 0 },
        { key: 'Silver Ingots',      emoji: '🪙', qty: matches['Silver Ingots'] ? parseInt(matches['Silver Ingots'][1], 10) : 0 },
        { key: 'Silver Ore',         emoji: '⚪', qty: matches['Silver Ore'] ? parseInt(matches['Silver Ore'][1], 10) : 0 },
        { key: 'Sticks',             emoji: '🥢', qty: matches['Sticks'] ? parseInt(matches['Sticks'][1], 10) : 0 },
        { key: 'Stones',             emoji: '🪨', qty: matches['Stones'] ? parseInt(matches['Stones'][1], 10) : 0 }
    ];

    const activeUpdates = resourceItems.filter(item => item.qty !== 0);
    if (activeUpdates.length === 0) return;

    try {
        await doc.loadInfo();
        
        const sheet = doc.sheetsByIndex[2]; 
        if (!sheet) {
            console.error("❌ Tab at Index 2 could not be verified.");
            await message.react('⚠️');
            return;
        }

        // FIXED: Set to exactly 50 rows and 23 columns to prevent "Out of bounds" errors
        await sheet.loadCells({ startRowIndex: 0, endRowIndex: 50, startColumnIndex: 0, endColumnIndex: 23 }); 

        // --- DYNAMIC FUZZY HEADER COLUMNS MAP ---
        const columnMap = {};
        for (let c = 0; c < 23; c++) {
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
                finalizedUpdates.push({
                    ...item,
                    col: columnMap[lookUpKey]
                });
            } else {
                console.warn(`⚠️ Mismatch warning: Could not map header items on row 9 for item: "${item.key}"`);
            }
        }

        if (finalizedUpdates.length === 0) {
            console.error("❌ None of the requested updates matched the spreadsheet columns.");
            await message.react('❓');
            return;
        }

        // --- USER ROW LOCATOR ---
        let playerRowIndex = -1;
        for (let r = 9; r < 50; r++) { 
            const cell = sheet.getCell(r, 1); 
            if (cell && cell.value && String(cell.value).trim().toLowerCase() === robloxUsername) {
                playerRowIndex = r;
                break;
            }
        }

        if (playerRowIndex === -1) {
            console.error(`❌ Could not locate structural player row index for user: "${robloxUsername}"`);
            await message.react('❓'); 
            return;
        }

        let isNegativeUpdate = false;

        finalizedUpdates.forEach(item => {
            if (item.qty < 0) isNegativeUpdate = true;

            // Global Amount Stored Totals updates on Row 3 (Index 2)
            const globalCell = sheet.getCell(2, item.col);
            const globalCurrent = parseInt(globalCell.value, 10) || 0;
            globalCell.value = globalCurrent + item.qty;

            // Individual row modifications
            const playerCell = sheet.getCell(playerRowIndex, item.col);
            const playerCurrent = parseInt(playerCell.value, 10) || 0;
            playerCell.value = playerCurrent + item.qty;
        });

        await sheet.saveUpdatedCells();

        if (isNegativeUpdate) {
            await message.react('🛠️'); 
        } else {
            await message.react('📦'); 
        }

        const announceChannel = client.channels.cache.get(ANNOUNCEMENT_CHANNEL_ID);
        if (announceChannel) {
            let summary = `### 📑 Inventory Updated by ${message.author} (${displayName.split('|')[1].trim()})\n`;
            finalizedUpdates.forEach(item => {
                const sign = item.qty > 0 ? `+${item.qty}` : `${item.qty}`;
                const pTotal = sheet.getCell(playerRowIndex, item.col).value || 0;
                summary += `• ${item.emoji} **${item.key}:** ${sign} *(Your Total: ${pTotal})*\n`;
            });
            await announceChannel.send(summary);
        }

    } catch (err) {
        console.error("Critical Runtime Error during Sheets API synchronization:", err);
        try {
            await message.react('⚠️');
        } catch (reactErr) {
            console.error("Failed to append fallback error status emoji:", reactErr);
        }
    }
});

client.login(token);