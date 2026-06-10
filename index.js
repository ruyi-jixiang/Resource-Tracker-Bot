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

    // REALIGNED: Charcoal begins strictly on Column D (Index 3). Everything else cascades back by 1.
    const resourceConfig = [
        { key: 'Charcoal',           col: 3,  emoji: '⬛', qty: matches['Charcoal'] ? parseInt(matches['Charcoal'][1], 10) : 0 },           // D
        { key: 'Coal Ore',           col: 4,  emoji: '🪨', qty: matches['Coal Ore'] ? parseInt(matches['Coal Ore'][1], 10) : 0 },           // E
        { key: 'Condensed Crystals', col: 5,  emoji: '🔮', qty: matches['Condensed Crystals'] ? parseInt(matches['Condensed Crystals'][1], 10) : 0 }, // F
        { key: 'Copper Ingots',      col: 6,  emoji: '🟧', qty: matches['Copper Ingots'] ? parseInt(matches['Copper Ingots'][1], 10) : 0 },   // G
        { key: 'Copper Ore',         col: 7,  emoji: '🟫', qty: matches['Copper Ore'] ? parseInt(matches['Copper Ore'][1], 10) : 0 },       // H
        { key: 'Gel',                col: 8,  emoji: '🟢', qty: matches['Gel'] ? parseInt(matches['Gel'][1], 10) : 0 },                     // I
        { key: 'Glass',              col: 9,  emoji: '⬜', qty: matches['Glass'] ? parseInt(matches['Glass'][1], 10) : 0 },                 // J
        { key: 'Gold Ingots',        col: 10, emoji: '🟨', qty: matches['Gold Ingots'] ? parseInt(matches['Gold Ingots'][1], 10) : 0 },     // K
        { key: 'Gold Ore',           col: 11, emoji: '🟡', qty: matches['Gold Ore'] ? parseInt(matches['Gold Ore'][1], 10) : 0 },         // L
        { key: 'Iron',               col: 12, emoji: '🟥', qty: matches['Iron'] ? parseInt(matches['Iron'][1], 10) : 0 },                 // M
        { key: 'Iron Ingots',        col: 13, emoji: '🔩', qty: matches['Iron Ingots'] ? parseInt(matches['Iron Ingots'][1], 10) : 0 },     // N
        { key: 'Leather',            col: 14, emoji: '🟫', qty: matches['Leather'] ? parseInt(matches['Leather'][1], 10) : 0 },           // O
        { key: 'Logs',               col: 15, emoji: '🪵', qty: matches['Logs'] ? parseInt(matches['Logs'][1], 10) : 0 },                 // P
        { key: 'Mana Crystals',      col: 16, emoji: '🟦', qty: matches['Mana Crystals'] ? parseInt(matches['Mana Crystals'][1], 10) : 0 }, // Q
        { key: 'Sandstone',          col: 17, emoji: '🧱', qty: matches['Sandstone'] ? parseInt(matches['Sandstone'][1], 10) : 0 },         // R
        { key: 'Silver Ingots',      col: 18, emoji: '🪙', qty: matches['Silver Ingots'] ? parseInt(matches['Silver Ingots'][1], 10) : 0 }, // S
        { key: 'Silver Ore',         col: 19, emoji: '⚪', qty: matches['Silver Ore'] ? parseInt(matches['Silver Ore'][1], 10) : 0 },     // T
        { key: 'Sticks',             col: 20, emoji: '🥢', qty: matches['Sticks'] ? parseInt(matches['Sticks'][1], 10) : 0 },             // U
        { key: 'Stones',             col: 21, emoji: '🪨', qty: matches['Stones'] ? parseInt(matches['Stones'][1], 10) : 0 }              // V
    ];

    const activeUpdates = resourceConfig.filter(item => item.qty !== 0);
    if (activeUpdates.length === 0) return;

    try {
        await doc.loadInfo();
        
        // Target the 3rd sheet tab dynamically using 0-based index
        const sheet = doc.sheetsByIndex[2]; 

        if (!sheet) {
            console.error("❌ The 3rd sheet page could not be found.");
            await message.react('⚠️');
            return;
        }

        // Fetch grid boundaries up to column Z safely
        await sheet.loadCells({ startRowIndex: 0, endRowIndex: 85, startColumnIndex: 0, endColumnIndex: 26 }); 

        let playerRowIndex = -1;
        for (let r = 7; r < 85; r++) { 
            const cell = sheet.getCell(r, 1); // Check column B (index 1) for usernames
            if (cell && cell.value && String(cell.value).trim().toLowerCase() === robloxUsername) {
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

        activeUpdates.forEach(item => {
            if (item.qty < 0) isNegativeUpdate = true;

            // Global Totals (Row 3, index 2)
            const globalCell = sheet.getCell(2, item.col);
            const globalCurrent = parseInt(globalCell.value, 10) || 0;
            globalCell.value = globalCurrent + item.qty;

            // Individual Player Row
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
            activeUpdates.forEach(item => {
                const sign = item.qty > 0 ? `+${item.qty}` : `${item.qty}`;
                const pTotal = sheet.getCell(playerRowIndex, item.col).value || 0;
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