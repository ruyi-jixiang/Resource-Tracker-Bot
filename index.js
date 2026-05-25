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

    // Regex parsing to capture numbers
    const ironMatch = content.match(/(\d+)\s*x?\s*iron/);
    const leatherMatch = content.match(/(\d+)\s*x?\s*leather/);
    const manaMatch = content.match(/(\d+)\s*x?\s*mana\s*crystal/);

    const ironQty = ironMatch ? parseInt(ironMatch[1]) : 0;
    const leatherQty = leatherMatch ? parseInt(leatherMatch[1]) : 0;
    const manaQty = manaMatch ? parseInt(manaMatch[1]) : 0;

    if (ironQty === 0 && leatherQty === 0 && manaQty === 0) return;

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

        const currentIron = parseInt(totalRow.get('Iron')) || 0;
        const currentLeather = parseInt(totalRow.get('Leather')) || 0;
        const currentMana = parseInt(totalRow.get('Mana Crystals')) || 0;

        // Calculate new totals
        const newIron = currentIron + ironQty;
        const newLeather = currentLeather + leatherQty;
        const newMana = currentMana + manaQty;

        // Save totals back as strings
        totalRow.set('Iron', String(newIron));
        totalRow.set('Leather', String(newLeather));
        totalRow.set('Mana Crystals', String(newMana));
        
        await totalRow.save();

        console.log(`📦 Added to RESOURCES page: ${ironQty} Iron | ${leatherQty} Leather | ${manaQty} Mana Crystals`);
        await message.react('📦');

        const announceChannel = client.channels.cache.get(ANNOUNCEMENT_CHANNEL_ID);
        if (announceChannel) {
            // Build a clean, readable breakdown of what was added
            let summary = `### 📥 Materials Deposited by ${message.author}\n`;
            if (ironQty > 0) summary += `• 🟥 **Iron:** +${ironQty} *(Total: ${newIron})*\n`;
            if (leatherQty > 0) summary += `• 🟫 **Leather:** +${leatherQty} *(Total: ${newLeather})*\n`;
            if (manaQty > 0) summary += `• 🟦 **Mana Crystals:** +${manaQty} *(Total: ${newMana})*\n`;

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