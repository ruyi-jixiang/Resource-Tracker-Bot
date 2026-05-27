const { Client, GatewayIntentBits, Events } = require('discord.js');
const { GoogleSpreadsheet } = require('google-spreadsheet');
const { JWT } = require('google-auth-library');

const RESOURCE_CHANNEL_ID = '1507988343281942618'; 
const SPREADSHEET_ID = '1gX6WECCSj0D_QJY0j06BFT6RMYVCrgG1-VUgw9fIVCE'; 
const ANNOUNCEMENT_CHANNEL_ID = '1507588311374495834';

const RESOURCE_CHANNEL_ID = '1504290958530052340'; 
const ANNOUNCEMENT_CHANNEL_ID = '1502882358817325126'; 
const SPREADSHEET_ID = '1tbSxj3YEPG1tRQdr8r03nJ1_Q8EEzKbEDaMBNkb3DEM';
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
  console.log(`✅ Multi-Row Fixed Tracker Bot ONLINE as ${c.user.tag}`);
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

    const content = message.content.toLowerCase().trim();

    // Word boundary standard matching constraints (\b) to isolate "stone" vs "stick" perfectly
    const ironMatch = content.match(/(-?\+?\d+)\s*x?\s*\biron\b/);
    const leatherMatch = content.match(/(-?\+?\d+)\s*x?\s*\bleather\b/);
    const manaMatch = content.match(/(-?\+?\d+)\s*x?\s*\bmana\s*crystal\b/);
    const stickMatch = content.match(/(-?\+?\d+)\s*x?\s*\bstick\b/);
    const stoneMatch = content.match(/(-?\+?\d+)\s*x?\s*\bstone\b/);
    const condensedMatch = content.match(/(-?\+?\d+)\s*x?\s*\bcondensed\s*crystal\b/);

    const ironQty = ironMatch ? parseInt(ironMatch[1], 10) : 0;
    const leatherQty = leatherMatch ? parseInt(leatherMatch[1], 10) : 0;
    const manaQty = manaMatch ? parseInt(manaMatch[1], 10) : 0;
    const stickQty = stickMatch ? parseInt(stickMatch[1], 10) : 0;
    const stoneQty = stoneMatch ? parseInt(stoneMatch[1], 10) : 0;
    const condensedQty = condensedMatch ? parseInt(condensedMatch[1], 10) : 0;

    if (ironQty === 0 && leatherQty === 0 && manaQty === 0 && stickQty === 0 && stoneQty === 0 && condensedQty === 0) return;

    try {
        await doc.loadInfo();
        const sheet = doc.sheetsByTitle["RESOURCES"]; 

        if (!sheet) {
            console.error("❌ Tab 'RESOURCES' not found.");
            await message.react('⚠️');
            return;
        }

        // Expanded coordinate bounding to safely handle row loops up to row 100 if your roster grows
        await sheet.loadCells('B2:I100'); 

        // 1. Target the Global "Amount Stored" cells directly by coordinate
        const globalCells = {
            'Iron': sheet.getCellByA1('C3'),
            'Leather': sheet.getCellByA1('D3'),
            'Mana Crystals': sheet.getCellByA1('E3'),
            'Stick': sheet.getCellByA1('F3'),
            'Stone': sheet.getCellByA1('G3'),
            'Condensed Crystals': sheet.getCellByA1('H3')
        };

        // 2. Loop through Column B (Rows 8 to 100) to find the player row
        let playerRowIndex = -1;
        for (let r = 7; r < 100; r++) { 
            const cellValue = sheet.getCell(r, 1).value; // Column B is index 1
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

        // 3. Map the player's specific row cells
        const playerCells = {
            'Iron': sheet.getCell(playerRowIndex, 2),              // Column C
            'Leather': sheet.getCell(playerRowIndex, 3),           // Column D
            'Mana Crystals': sheet.getCell(playerRowIndex, 4),     // Column E
            'Stick': sheet.getCell(playerRowIndex, 5),             // Column F
            'Stone': sheet.getCell(playerRowIndex, 6),             // Column G
            'Condensed Crystals': sheet.getCell(playerRowIndex, 7) // Column H
        };

        const resources = [
            { key: 'Iron', qty: ironQty, emoji: '🟥' },
            { key: 'Leather', qty: leatherQty, emoji: '🟫' },
            { key: 'Mana Crystals', qty: manaQty, emoji: '🟦' },
            { key: 'Stick', qty: stickQty, emoji: '🪵' },
            { key: 'Stone', qty: stoneQty, emoji: '🪨' }, // Syntax validation duplication cleared here
            { key: 'Condensed Crystals', qty: condensedQty, emoji: '🔮' }
        ];

        // 4. Update values cleanly
        resources.forEach(item => {
            if (item.qty === 0) return;

            // Update Master Pool
            const globalCurrent = parseInt(globalCells[item.key].value) || 0;
            globalCells[item.key].value = globalCurrent + item.qty;

            // Update Individual Player Row
            const playerCurrent = parseInt(playerCells[item.key].value) || 0;
            playerCells[item.key].value = playerCurrent + item.qty;
        });

        // Save sheet changes all at once
        await sheet.saveUpdatedCells();

        if (ironQty < 0 || leatherQty < 0 || manaQty < 0 || stickQty < 0 || stoneQty < 0 || condensedQty < 0) {
            await message.react('🛠️'); 
        } else {
            await message.react('📦'); 
        }

        // Fetch announcement log channel directly from cache via Client channels manager
        const announceChannel = client.channels.cache.get(ANNOUNCEMENT_CHANNEL_ID);
        if (announceChannel) {
            const today = new Date();
            const formattedDate = `${String(today.getMonth() + 1).padStart(2, '0')}/${String(today.getDate()).padStart(2, '0')}/${today.getFullYear()}`;
            
            let summary = `### 📑 Inventory Updated by ${message.author} (\`${displayName.split('|')[1].trim()}\`)\n`;
            resources.forEach(item => {
                if (item.qty === 0) return;
                const sign = item.qty > 0 ? `+${item.qty}` : `${item.qty}`;
                const pTotal = playerCells[item.key].value;
                summary += `• ${item.emoji} **${item.key}:** \`${sign}\` *(Your Total: ${pTotal})*\n`;
            });
            summary += `\n📅 *Logged on: ${formattedDate}*`;
            
            await announceChannel.send(summary);
        }

    } catch (err) {
        console.error("Error updating sheet:", err);
        await message.react('⚠️');
    }
});

client.login(token);