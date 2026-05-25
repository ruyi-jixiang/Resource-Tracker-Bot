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
    GatewayIntentBits.MessageContent 
  ]
});

client.once(Events.ClientReady, (c) => {
  console.log(`✅ Resources Tab Accumulator Bot ONLINE as ${c.user.tag}`);
});

client.on(Events.MessageCreate, async (message) => {
    if (message.author.bot) return;
    if (message.channel.id !== RESOURCE_CHANNEL_ID) return;

    const content = message.content.toLowerCase();

    // Regex parsing to capture numbers for all 6 resource types
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

    // Exit early if no monitored items were mentioned
    if (ironQty === 0 && leatherQty === 0 && manaQty === 0 && stickQty === 0 && stoneQty === 0 && condensedQty === 0) return;

    try {
        await doc.loadInfo();
        
        const sheet = doc.sheetsByTitle["RESOURCES"]; 

        if (!sheet) {
            console.error("❌ Could not find a tab named 'RESOURCES' on this spreadsheet.");
            await message.react('⚠️');
            return;
        }

        await sheet.loadHeaderRow(2);
        const rows = await sheet.getRows();

        let totalRow = rows.find(row => {
            return row.get('Resource') === 'Amount';
        });

        if (!totalRow) {
            totalRow = rows[0]; 
        }

        if (!totalRow) {
            console.error("❌ Could not locate total accumulation row inside RESOURCES tab.");
            await message.react('⚠️');
            return;
        }

        // Pull old values (exactly matching headers on Row 2 of your sheet)
        const currentIron = parseInt(totalRow.get('Iron')) || 0;
        const currentLeather = parseInt(totalRow.get('Leather')) || 0;
        const currentMana = parseInt(totalRow.get('Mana Crystals')) || 0;
        const currentStick = parseInt(totalRow.get('Stick')) || 0;
        const currentStone = parseInt(totalRow.get('Stone')) || 0;
        const currentCondensed = parseInt(totalRow.get('Condensed Crystals')) || 0;

        // Calculate running totals
        const newIron = currentIron + ironQty;
        const newLeather = currentLeather + leatherQty;
        const newMana = currentMana + manaQty;
        const newStick = currentStick + stickQty;
        const newStone = currentStone + stoneQty;
        const newCondensed = currentCondensed + condensedQty;

        // Save updated data back to columns
        totalRow.set('Iron', String(newIron));
        totalRow.set('Leather', String(newLeather));
        totalRow.set('Mana Crystals', String(newMana));
        totalRow.set('Stick', String(newStick));
        totalRow.set('Stone', String(newStone));
        totalRow.set('Condensed Crystals', String(newCondensed));
        
        await totalRow.save();

        console.log(`📦 Updated RESOURCES page: ${ironQty} Iron | ${leatherQty} Leather | ${manaQty} Mana | ${stickQty} Stick | ${stoneQty} Stone | ${condensedQty} Condensed`);
        
        // Dynamic reaction based on total action type
        if (ironQty < 0 || leatherQty < 0 || manaQty < 0 || stickQty < 0 || stoneQty < 0 || condensedQty < 0) {
            await message.react('🛠️'); 
        } else {
            await message.react('📦'); 
        }

        // ANNOUNCEMENT LOGIC
        const announceChannel = client.channels.cache.get(ANNOUNCEMENT_CHANNEL_ID);
        if (announceChannel) {
            const formatLine = (qty, label, currentTotal, emoji) => {
                if (qty === 0) return '';
                const actionSign = qty > 0 ? `+${qty}` : `${qty}`;
                return `• ${emoji} **${label}:** ${actionSign} *(Total: ${currentTotal})*\n`;
            };

            let summary = `### 📑 Resource Log Update by ${message.author}\n`;
            summary += formatLine(ironQty, 'Iron', newIron, '🟥');
            summary += formatLine(leatherQty, 'Leather', newLeather, '🟫');
            summary += formatLine(manaQty, 'Mana Crystals', newMana, '🟦');
            summary += formatLine(stickQty, 'Stick', newStick, '🪵');
            summary += formatLine(stoneQty, 'Stone', newStone, '🪨');
            summary += formatLine(condensedQty, 'Condensed Crystals', newCondensed, '🔮');

            await announceChannel.send(summary);
        } else {
            console.error("❌ Announcement channel not found. Check your ANNOUNCEMENT_CHANNEL_ID.");
        }

    } catch (err) {
        console.error("Error logging resources:", err);
        await message.react('⚠️');
    }
});

client.login(token);