const { Client, GatewayIntentBits, Events } = require('discord.js');
const { GoogleSpreadsheet } = require('google-spreadsheet');
const { JWT } = require('google-auth-library');

const RESOURCE_CHANNEL_ID = '1507988343281942618'; 
const SPREADSHEET_ID = '1gX6WECCSj0D_QJY0j06BFT6RMYVCrgG1-VUgw9fIVCE'; 
const ANNOUNCEMENT_CHANNEL_ID = '1507588311374495834';

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
    GatewayIntentBits.GuildMembers // REQUIRED: Ensure this intent is toggled on your Discord Developer Dashboard
  ]
});

client.once(Events.ClientReady, (c) => {
  console.log(`✅ Multi-Row Resource Tracker Bot ONLINE as ${c.user.tag}`);
});

client.on(Events.MessageCreate, async (message) => {
    if (message.author.bot) return;
    if (message.channel.id !== RESOURCE_CHANNEL_ID) return;

    // 1. EXTRACT ROBLOX USERNAME FROM DISCORD SERVER NICKNAME
    // Grabs everything after the "|" character and trims excess spaces
    const displayName = message.member ? message.member.displayName : '';
    if (!displayName.includes('|')) {
        console.log(`⚠️ ${message.author.tag} does not have a '|' in their server nickname. Skipping track.`);
        await message.react('⚠️');
        return;
    }
    const robloxUsername = displayName.split('|')[1].trim();

    const content = message.content.toLowerCase();

    // Regex parsing to capture material amounts
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
            console.error("❌ Could not find a tab named 'RESOURCES' on this spreadsheet.");
            await message.react('⚠️');
            return;
        }

        // Based on your layout, row 2 is the master header row
        await sheet.loadHeaderRow(2);
        const rows = await sheet.getRows();

        const totalRow = rows.find(row => row.get('Resource Type') === 'Amount Stored');
        
        const playerRow = rows.find(row => {
            const cellValue = row.get('Players');
            return cellValue && cellValue.trim().toLowerCase() === robloxUsername.toLowerCase();
        });

        if (!playerRow) {
            console.error(`❌ Could not find a row for player: "${robloxUsername}" in the sheet.`);
            await message.react('❓'); // Question mark emoji means player row missing
            return;
        }

        const resources = [
            { key: 'Iron', qty: ironQty, emoji: '🟥' },
            { key: 'Leather', qty: leatherQty, emoji: '🟫' },
            { key: 'Mana Crystals', qty: manaMatch ? manaQty : 0, emoji: '🟦' },
            { key: 'Stick', qty: stickQty, emoji: '🪵' },
            { key: 'Stone', qty: stoneQty, emoji: '🪨' },
            { key: 'Condensed Crystals', qty: condensedMatch ? condensedQty : 0, emoji: '🔮' }
        ];

        // 3. EXECUTE CALCULATION AND UPDATE CELL VALUES FOR BOTH ROWS
        resources.forEach(item => {
            if (item.qty === 0) return;

            // Update Master Pool
            if (totalRow) {
                const globalCurrent = parseInt(totalRow.get(item.key)) || 0;
                totalRow.set(item.key, String(globalCurrent + item.qty));
            }

            // Update Player Pool
            const playerCurrent = parseInt(playerRow.get(item.key)) || 0;
            playerRow.set(item.key, String(playerCurrent + item.qty));
        });

        // Save row updates back to Google API
        if (totalRow) await totalRow.save();
        await playerRow.save();

        // Add visual channel feedback
        if (ironQty < 0 || leatherQty < 0 || manaQty < 0 || stickQty < 0 || stoneQty < 0 || condensedQty < 0) {
            await message.react('🛠️'); 
        } else {
            await message.react('📦'); 
        }

        // ANNOUNCEMENT SUMMARY GENERATION
        const announceChannel = client.channels.cache.get(ANNOUNCEMENT_CHANNEL_ID);
        if (announceChannel) {
            let summary = `### 📑 Inventory Updated by ${message.author} (${robloxUsername})\n`;
            resources.forEach(item => {
                if (item.qty === 0) return;
                const sign = item.qty > 0 ? `+${item.qty}` : `${item.qty}`;
                const pTotal = playerRow.get(item.key);
                summary += `• ${item.emoji} **${item.key}:** ${sign} *(Your Total: ${pTotal})*\n`;
            });

            await announceChannel.send(summary);
        }

    } catch (err) {
        console.error("Error logging resources:", err);
        await message.react('⚠️');
    }
});

client.login(token);