const { Client, GatewayIntentBits, Events } = require('discord.js');
const { GoogleSpreadsheet } = require('google-spreadsheet');
const { JWT } = require('google-auth-library');

const RESOURCE_CHANNEL_ID = '1508516445653303296'; 
const SPREADSHEET_ID = '1gX6WECCSj0D_QJY0j06BFT6RMYVCrgG1-VUgw9fIVCE'; 


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
  console.log(`✅ Total Accumulator Bot ONLINE as ${c.user.tag}`);
});

client.on(Events.MessageCreate, async (message) => {
    if (message.author.bot) return;
    if (message.channel.id !== RESOURCE_CHANNEL_ID) return;

    const content = message.content.toLowerCase();

    // Regex parsing to capture numbers from patterns like "15 iron", "5 leather", "2 mana crystals"
    const ironMatch = content.match(/(\d+)\s*x?\s*iron/);
    const leatherMatch = content.match(/(\d+)\s*x?\s*leather/);
    const manaMatch = content.match(/(\d+)\s*x?\s*mana\s*crystal/);

    const ironQty = ironMatch ? parseInt(ironMatch[1]) : 0;
    const leatherQty = leatherMatch ? parseInt(leatherMatch[1]) : 0;
    const manaQty = manaMatch ? parseInt(manaMatch[1]) : 0;

    // Ignore chatter that doesn't contain any tracked resource claims
    if (ironQty === 0 && leatherQty === 0 && manaQty === 0) return;

    try {
        await doc.loadInfo();
        const sheet = doc.sheetsByIndex[0]; // Interacts with your first tab

        // Tell the bot headers are on Row 1
        await sheet.loadHeaderRow(1);
        const rows = await sheet.getRows();

        // Target the "Resource Amount" row directly (Row 3 on your sheet is index 1 in our rows list)
        // This targets the exact gray cells from your screenshot
        let totalRow = rows[1]; 

        if (!totalRow) {
            console.error("Could not locate the total accumulation row in the spreadsheet.");
            await message.react('⚠️');
            return;
        }

        // Get the current totals from Columns C, D, and E
        const currentIron = parseInt(totalRow.get('Iron')) || 0;
        const currentLeather = parseInt(totalRow.get('Leather')) || 0;
        const currentMana = parseInt(totalRow.get('Mana Crystals')) || 0;

        // Add the newly reported quantities to the old numbers
        totalRow.set('Iron', String(currentIron + ironQty));
        totalRow.set('Leather', String(currentLeather + leatherQty));
        totalRow.set('Mana Crystals', String(currentMana + manaQty));
        
        // Save the updated totals back to the sheet row
        await totalRow.save();

        console.log(`📦 Added ${ironQty} Iron, ${leatherQty} Leather, ${manaQty} Mana to global pool.`);
        await message.react('📦');

    } catch (err) {
        console.error("Error logging resources:", err);
        await message.react('❌');
    }
});

client.login(token);