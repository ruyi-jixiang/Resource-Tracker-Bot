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

    // Comprehensive regex matches for ALL resource types in the layout
    const matches = {
        'Charcoal': content.match(/(-?\+?\d+)\s*x?\s*charcoal/),
        'Coal Ore': content.match(/(-?\+?\d+)\s*x?\s*coal\s*ore/),
        'Condensed Crystals': content.match(/(-?\+?\d+)\s*x?\s*condensed\s*crystal/),
        'Copper Ingots': content.match(/(-?\+?\d+)\s*x?\s*copper\s*ingot/),
        'Copper Ore': content.match(/(-?\+?\d+)\s*x?\s*copper\s*ore/),
        'Gel': content.match(/(-?\+?\d+)\s*x?\s*gel/),
        'Glass': content.match(/(-?\+?\d+)\s*x?\s*glass/),
        'Gold Ingots': content.match(/(-?\+?\d+)\s*x?\s*gold\s*ingot/),
        'Gold Ore': content.match(/(-?\+?\d+)\s*x?\s*gold\s*ore/),
        'Iron': content.match(/(-?\+?\d+)\s*x?\s*iron(?!\s*ingot)/), // ignores 'iron ingot'
        'Iron Ingots': content.match(/(-?\+?\d+)\s*x?\s*iron\s*ingot/),
        'Leather': content.match(/(-?\+?\d+)\s*x?\s*leather/),
        'Logs': content.match(/(-?\+?\d+)\s*x?\s*log/),
        'Mana Crystals': content.match(/(-?\+?\d+)\s*x?\s*mana\s*crystal/),
        'Sandstone': content.match(/(-?\+?\d+)\s*x?\s*sandstone/),
        'Silver Ingots': content.match(/(-?\+?\d+)\s*x?\s*silver\s*ingot/),
        'Silver Ore': content.match(/(-?\+?\d+)\s*x?\s*silver\s*ore/),
        'Sticks': content.match(/(-?\+?\d+)\s*x?\s*stick/),
        'Stones': content.match(/(-?\+?\d+)\s*x?\s*stone/)
    };

    // Construct unified dynamic configuration array 
    const resourceConfig = [
        { key: 'Charcoal',           col: 2,  emoji: '⬛', qty: matches['Charcoal'] ? parseInt(matches['Charcoal'][1], 10) : 0 },
        { key: 'Coal Ore',           col: 3,  emoji: '🪨', qty: matches['Coal Ore'] ? parseInt(matches['Coal Ore'][1], 10) : 0 },
        { key: 'Condensed Crystals', col: 4,  emoji: '🔮', qty: matches['Condensed Crystals'] ? parseInt(matches['Condensed Crystals'][1], 10) : 0 },
        { key: 'Copper Ingots',      col: 5,  emoji: '🟧', qty: matches['Copper Ingots'] ? parseInt(matches['Copper Ingots'][1], 10) : 0 },
        { key: 'Copper Ore',         col: 6,  emoji: '🟫', qty: matches['Copper Ore'] ? parseInt(matches['Copper Ore'][1], 10) : 0 },
        { key: 'Gel',                col: 7,  emoji: '🟢', qty: matches['Gel'] ? parseInt(matches['Gel'][1], 10) : 0 },
        { key: 'Glass',              col: 8,  emoji: '⬜', qty: matches['Glass'] ? parseInt(matches['Glass'][1], 10) : 0 },
        { key: 'Gold Ingots',        col: 9,  emoji: '🟨', qty: matches['Gold Ingots'] ? parseInt(matches['Gold Ingots'][1], 10) : 0 },
        { key: 'Gold Ore',           col: 10, emoji: '🟡', qty: matches['Gold Ore'] ? parseInt(matches['Gold Ore'][1], 10) : 0 },
        { key: 'Iron',               col: 11, emoji: '🟥', qty: matches['Iron'] ? parseInt(matches['Iron'][1], 10) : 0 },
        { key: 'Iron Ingots',        col: 12, emoji: '🔩', qty: matches['Iron Ingots'] ? parseInt(matches['Iron Ingots'][1], 10) : 0 },
        { key: 'Leather',            col: 13, emoji: '🟫', qty: matches['Leather'] ? parseInt(matches['Leather'][1], 10) : 0 },
        { key: 'Logs',               col: 14, emoji: '🪵', qty: matches['Logs'] ? parseInt(matches['Logs'][1], 10) : 0 },
        { key: 'Mana Crystals',      col: 15, emoji: '🟦', qty: matches['Mana Crystals'] ? parseInt(matches['Mana Crystals'][1], 10) : 0 },
        { key: 'Sandstone',          col: 16, emoji: '🧱', qty: matches['Sandstone'] ? parseInt(matches['Sandstone'][1], 10) : 0 },
        { key: 'Silver Ingots',      col: 17, emoji: '🪙', qty: matches['Silver Ingots'] ? parseInt(matches['Silver Ingots'][1], 10) : 0 },
        { key: 'Silver Ore',         col: 18, emoji: '⚪', qty: matches['Silver Ore'] ? parseInt(matches['Silver Ore'][1], 10) : 0 },
        { key: 'Sticks',             col: 19, emoji: '🥢', qty: matches['Sticks'] ? parseInt(matches['Sticks'][1], 10) : 0 },
        { key: 'Stones',             col: 20, emoji: '🪨', qty: matches['Stones'] ? parseInt(matches['Stones'][1], 10) : 0 }
    ];

    // Filter out items that have no alterations in the message
    const activeUpdates = resourceConfig.filter(item => item.qty !== 0);
    if (activeUpdates.length === 0) return;

    try {
        await doc.loadInfo();
        const sheet = doc.sheetsByTitle["RESOURCES"]; 

        if (!sheet) {
            console.error("❌ Tab 'RESOURCES' not found.");
            await message.react('⚠️');
            return;
        }

        // Expanded bounds to cover up to index 20 (Column U/V/W areas) safely
        await sheet.loadCells('A1:Y70'); 

        // 1. Locate User Row (Column B, Index 1)
        let playerRowIndex = -1;
        for (let r = 7; r < 70; r++) { 
            const cellValue = sheet.getCellValue ? sheet.getCell(r, 1).value : sheet.getCell(r, 1).value;
            if (cellValue && String(cellValue).trim().toLowerCase() === robloxUsername) {
                playerRowIndex = r;
                break;
            }
        }

        if (playerRowIndex === -1) {
            console.error(`❌ Could not locate row for username: "${robloxUsername}"`);
            await message.react('❓'); 
            return;
        }

        let isNegativeUpdate = false;

        // 2. Dynamic spreadsheet manipulation loop
        activeUpdates.forEach(item => {
            if (item.qty < 0) isNegativeUpdate = true;

            // Global Totals updates (Row 3, Index 2)
            const globalCell = sheet.getCell(2, item.col);
            const globalCurrent = parseInt(globalCell.value, 10) || 0;
            globalCell.value = globalCurrent + item.qty;

            // Player specific row updates
            const playerCell = sheet.getCell(playerRowIndex, item.col);
            const playerCurrent = parseInt(playerCell.value, 10) || 0;
            playerCell.value = playerCurrent + item.qty;
        });

        await sheet.saveUpdatedCells();

        // Single clean reaction feedback
        if (isNegativeUpdate) {
            await message.react('🛠️'); 
        } else {
            await message.react('📦'); 
        }

        // Announcement logger channel output
        const announceChannel = client.channels.cache.get(ANNOUNCEMENT_CHANNEL_ID);
        if (announceChannel) {
            let summary = `### 📑 Inventory Updated by ${message.author} (${displayName.split('|')[1].trim()})\n`;
            activeUpdates.forEach(item => {
                const sign = item.qty > 0 ? `+${item.qty}` : `${item.qty}`;
                const pTotal = sheet.getCell(playerRowIndex, item.col).value;
                summary += `• ${item.emoji} **${item.key}:** ${sign} *(Your Total: ${pTotal})*\n`;
            });
            await announceChannel.send(summary);
        }

    } catch (err) {
        console.error("Error updating sheet:", err);
        try {
            await message.react('⚠️');
        } catch (reactErr) {
            console.error("Failed to apply error reaction:", reactErr);
        }
    }
});

client.login(token);