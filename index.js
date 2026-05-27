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
  console.log(`✅ Fixed Total & Player Tracker ONLINE as ${c.user.tag}`);
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

    const ironMatch = content.match(/(-?\+?\d+)\s*x?\s*iron/);
    const leatherMatch = content.match(/(-?\+?\d+)\s*x?\s*leather/);
    const manaMatch = content.match(/(-?\+?\d+)\s*x?\s*mana\s*crystal/);
    const stickMatch = content.match(/(-?\+?\d+)\s*x?\s*stick/);
    const stoneMatch = content.match(/(-?\+?\d+)\s*x?\s*stone/);
    const condensedMatch = content.match(/(-?\+?\d+)\s*x?\s*condensed\s*crystal/);

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

        // Load complete working area grid boundary
        await sheet.loadCells('A1:L60'); 

        // 1. Map Global Totals using absolute index coordinates:
        // Row 3 (Index 2). Columns are: C=2, D=3, E=4, F=5, G=6, H=7
        const globalCells = {
            'Iron': sheet.getCell(2, 2),
            'Leather': sheet.getCell(2, 3),
            'Mana Crystals': sheet.getCell(2, 4),
            'Stick': sheet.getCell(2, 5),
            'Stone': sheet.getCell(2, 6),
            'Condensed Crystals': sheet.getCell(2, 7)
        };

        // 2. Scan Column B (Index 1) to locate the unique player row index
        let playerRowIndex = -1;
        for (let r = 7; r < 60; r++) { 
            const cellValue = sheet.getCell(r, 1).value; 
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

        // 3. Map Player Specific Cells:
        // Columns are: D=3, E=4, F=5, G=6, H=7, I=8
        const playerCells = {
            'Iron': sheet.getCell(playerRowIndex, 3),
            'Leather': sheet.getCell(playerRowIndex, 4),
            'Mana Crystals': sheet.getCell(playerRowIndex, 5),
            'Stick': sheet.getCell(playerRowIndex, 6),
            'Stone': sheet.getCell(playerRowIndex, 7),
            'Condensed Crystals': sheet.getCell(playerRowIndex, 8)
        };

        const resources = [
            { key: 'Iron', qty: ironQty, emoji: '🟥' },
            { key: 'Leather', qty: leatherQty, emoji: '🟫' },
            { key: 'Mana Crystals', qty: manaQty, emoji: '🟦' },
            { key: 'Stick', qty: stickQty, emoji: '🪵' },
            { key: 'Stone', qty: stoneQty, emoji: '🪨' },
            { key: 'Condensed Crystals', qty: condensedQty, emoji: '🔮' }
        ];

        // 4. Update the numerical values on both layers
        resources.forEach(item => {
            if (item.qty === 0) return;

            // Process Total pool updates
            const globalCurrent = parseInt(globalCells[item.key].value) || 0;
            globalCells[item.key].value = globalCurrent + item.qty;

            // Process Individual profile updates
            const playerCurrent = parseInt(playerCells[item.key].value) || 0;
            playerCells[item.key].value = playerCurrent + item.qty;
        });

        // Push updates to Google Sheets API
        await sheet.saveUpdatedCells();

        if (ironQty < 0 || leatherQty < 0 || manaQty < 0 || stickQty < 0 || stoneQty < 0 || condensedQty < 0) {
            await message.react('🛠️'); 
        } else {
            await message.react('📦'); 
        }

        // Send the announcement log confirmation
        const announceChannel = client.channels.cache.get(ANNOUNCEMENT_CHANNEL_ID);
        if (announceChannel) {
            let summary = `### 📑 Inventory Updated by ${message.author} (${displayName.split('|')[1].trim()})\n`;
            resources.forEach(item => {
                if (item.qty === 0) return;
                const sign = item.qty > 0 ? `+${item.qty}` : `${item.qty}`;
                const pTotal = playerCells[item.key].value;
                summary += `• ${item.emoji} **${item.key}:** ${sign} *(Your Total: ${pTotal})*\n`;
            });
            await announceChannel.send(summary);
        }

    } catch (err) {
        console.error("Error updating sheet:", err);
        await message.react('⚠️');
    }
});

client.login(token);