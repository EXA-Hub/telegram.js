import 'dotenv/config';
import TelegramBot from "node-telegram-bot-api";
import { existsSync, mkdirSync, readdirSync } from "fs";

// replace the value below with the Telegram token you receive from @BotFather
const token = process.env.TOKEN;

const downloadsFolder = "./downloads"; // Replace with your actual downloads folder path

if (!existsSync(downloadsFolder)) {
    mkdirSync(downloadsFolder);
}

// Create a bot that uses 'polling' to fetch new updates
const bot = new TelegramBot(token, { polling: true });

bot.on('polling_error', (error) => {
    console.error('Polling error:', error);
});


// Matches "/upload [whatever]"
bot.onText(/\/upload/, (msg) => {
    const chatId = msg.chat.id;
    bot.sendMessage(chatId, "Enter folder name:").then(() => {
        bot.once("message", (msg) => {
            const folderName = msg.text;
            const folderPath = `${downloadsFolder}/${folderName}`;
            if (!existsSync(folderPath)) {
                mkdirSync(folderPath);
            }
            bot.sendMessage(chatId, "Please upload the file:").then(() => {
                bot.once("document", (msg) => {
                    const fileName = msg.document.file_name;
                    bot.downloadFile(msg.document.file_id, folderPath)
                        .then(() => {
                            bot.sendMessage(chatId, `File ${fileName} uploaded successfully!`);
                        })
                        .catch((error) => {
                            console.error("Error downloading file:", error);
                            bot.sendMessage(chatId, "An error occurred while downloading the file.");
                        });
                });
            });
        });
    });
});

// Matches "/file [whatever]"
bot.onText(/\/file/, (msg) => {
    const chatId = msg.chat.id;
    // Generate buttons for each folder in the downloads directory
    const folderButtons = readdirSync(downloadsFolder).map(folderName => {
        return [{ text: folderName, callback_data: `folder_${folderName}` }];
    });

    const folderOptions = {
        reply_markup: JSON.stringify({
            inline_keyboard: folderButtons
        })
    };

    bot.sendMessage(chatId, "Choose a folder:", folderOptions).then(foldersChoices => {

        bot.once("callback_query", (callbackQuery) => {

            bot.deleteMessage(chatId, foldersChoices.message_id)
                .catch(error => {
                    console.error('Error deleting file message:', error);
                });

            const folderName = callbackQuery.data.split('_')[1];
            const folderPath = `${downloadsFolder}/${folderName}`;

            // Check if the folder exists
            if (!existsSync(folderPath)) {
                bot.sendMessage(chatId, `Folder ${folderName} does not exist!`);
                return;
            }

            // Generate buttons for each file in the folder
            const fileButtons = readdirSync(folderPath).map(fileName => {
                return [{ text: fileName, callback_data: `file_${fileName}` }];
            });

            if (fileButtons.length === 0) {
                bot.sendMessage(chatId, `Folder ${folderName} is empty!`);
                return;
            }

            const fileOptions = {
                reply_markup: JSON.stringify({
                    inline_keyboard: fileButtons
                })
            };

            bot.sendMessage(chatId, "Choose a file:", fileOptions).then(filesChoices => {

                bot.once("callback_query", (fileCallbackQuery) => {

                    bot.deleteMessage(chatId, filesChoices.message_id)
                        .catch(error => {
                            console.error('Error deleting file message:', error);
                        });

                    const fileName = (fileCallbackQuery.message.reply_markup.inline_keyboard.find(buttonsFilter =>
                        buttonsFilter[0].callback_data === fileCallbackQuery.data
                    ))[0].text;
                    const filePath = `${folderPath}/${fileName}`;

                    // Send the file
                    bot.sendDocument(chatId, filePath).then(() => {
                        bot.sendMessage(chatId, "File sent successfully!");
                    }).catch((err) => {
                        console.error(err);
                        bot.sendMessage(chatId, `File ${fileName} does not exist!`);
                    });
                });
            });
        });
    });
});

console.log("Bot is running...");