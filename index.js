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
  console.log(`✅ Resource Tracker Bot ONLINE as ${c.user.tag}`);
});

client.on(Events.MessageCreate, async (message) => {
    if (message.author.bot) return;
    if (message.channel.id !== RESOURCE_CHANNEL_ID) return;

    const content = message.content.toLowerCase();

    // Regex parsing to capture numbers from patterns like "12x iron", "3 leather", "5 mana crystals"
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

        await sheet.loadHeaderRow(1);
        const rows = await sheet.getRows();

        const userTag = message.author.tag;

        // Try to find if this user already has a row in the spreadsheet
        // Assuming Column A is where you track who submitted it, or we create it
        let userRow = rows.find(row => {
            const currentCell = row.get('Discord User');
            return currentCell && currentCell.trim().toLowerCase() === userTag.toLowerCase();
        });

        if (userRow) {
            // USER EXISTS: Add the new quantities to their current totals
            const currentIron = parseInt(userRow.get('Iron')) || 0;
            const currentLeather = parseInt(userRow.get('Leather')) || 0;
            // Matches your sheet's exact header spelling: "Mana Crystals"
            const currentMana = parseInt(userRow.get('Mana Crystals')) || 0;

            userRow.set('Iron', String(currentIron + ironQty));
            userRow.set('Leather', String(currentLeather + leatherQty));
            userRow.set('Mana Crystals', String(currentMana + manaQty));
            await userRow.save();

            console.log(`🔄 Updated totals for ${userTag}`);
        } else {
            // NEW USER: Append a clean brand new row
            await sheet.addRow({
                'Discord User': userTag,
                'Iron': String(ironQty),
                'Leather': String(leatherQty),
                'Mana Crystals': String(manaQty)
            });

            console.log(`➕ Added new row entry for ${userTag}`);
        }

        // React with a package emoji to signal success
        await message.react('📦');

    } catch (err) {
        console.error("Error logging resources:", err);
        await message.react('❌');
    }
});

client.login(token);