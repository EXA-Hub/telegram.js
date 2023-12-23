import 'dotenv/config';
import { lookup } from "mime-types";
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
process.env.NTBA_FIX_350 = true;
import TelegramBot from "node-telegram-bot-api";
import { existsSync, mkdirSync, readdirSync, renameSync } from "fs";


const token = process.env.TOKEN;
const __dirname = dirname(fileURLToPath(import.meta.url));
const downloadsFolder = join(__dirname, "downloads");

if (!existsSync(downloadsFolder)) {
    mkdirSync(downloadsFolder);
}

const bot = new TelegramBot(token, { polling: true });

bot.on('polling_error', (error) => {
    console.error('Polling error:', error);
});

// Matches "/upload [whatever]"
bot.onText(/\/upload/, (msg) => {
    const chatId = msg.chat.id;
    let folderPath = downloadsFolder;

    bot.sendMessage(chatId, "Enter first folder name:").then(() => {
        bot.once("message", (msg) => {
            const firstFolderName = msg.text;
            folderPath = join(folderPath, firstFolderName);

            if (!existsSync(folderPath)) {
                mkdirSync(folderPath, { recursive: true });
            }

            bot.sendMessage(chatId, "Enter second folder name:").then(() => {
                bot.once("message", (msg) => {
                    const secondFolderName = msg.text;
                    folderPath = join(folderPath, secondFolderName);

                    if (!existsSync(folderPath)) {
                        mkdirSync(folderPath, { recursive: true });
                    }

                    bot.sendMessage(chatId, "Please upload the file:").then(() => {
                        bot.once("document", (msg) => {
                            const fileName = msg.document.file_name;
                            bot.downloadFile(msg.document.file_id, folderPath).then((savedFile) => {
                                bot.sendMessage(chatId, `File ${fileName} uploaded successfully!`);
                                const uploadedFilePath = join(folderPath, fileName);
                                // Rename the file
                                renameSync(join(savedFile), uploadedFilePath);
                            }).catch((error) => {
                                console.error("Error downloading file:", error);
                                bot.sendMessage(chatId, "An error occurred while downloading the file.");
                            });
                        });
                    });
                });
            });
        });
    });
});

bot.onText(/\/file/, (msg) => {
    const chatId = msg.chat.id;
    const mainFolders = readdirSync(downloadsFolder);

    if (mainFolders.length === 0) {
        bot.sendMessage(chatId, "No main folders available!");
        return;
    }

    const folderButtons = mainFolders.map(folderName => {
        return [{ text: folderName, callback_data: `mainFolder_${folderName}` }];
    });

    const folderOptions = {
        reply_markup: JSON.stringify({
            inline_keyboard: folderButtons
        })
    };

    bot.sendMessage(chatId, "Choose a main folder:", folderOptions).then(mainFoldersChoices => {
        bot.once("callback_query", (mainFolderCallbackQuery) => {
            bot.deleteMessage(chatId, mainFoldersChoices.message_id).catch(error => {
                console.error('Error deleting main folder message:', error);
            });

            const mainFolderName = mainFolderCallbackQuery.data.split('_')[1];
            const mainFolderPath = join(downloadsFolder, mainFolderName);

            if (!existsSync(mainFolderPath)) {
                bot.sendMessage(chatId, `Main folder ${mainFolderName} does not exist!`);
                return;
            }

            const subFolders = readdirSync(mainFolderPath);

            if (subFolders.length === 0) {
                bot.sendMessage(chatId, `No subfolders available in ${mainFolderName}!`);
                return;
            }

            const subFolderButtons = subFolders.map(subFolderName => {
                return [{ text: subFolderName, callback_data: `subFolder_${subFolderName}` }];
            });

            const subFolderOptions = {
                reply_markup: JSON.stringify({
                    inline_keyboard: subFolderButtons
                })
            };

            bot.sendMessage(chatId, "Choose a subfolder:", subFolderOptions).then(() => {
                bot.once("callback_query", (subFolderCallbackQuery) => {
                    bot.deleteMessage(chatId, subFolderCallbackQuery.message.message_id).catch(error => {
                        console.error('Error deleting subfolder message:', error);
                    });

                    const subFolderName = subFolderCallbackQuery.data.split('_')[1];
                    const subFolderPath = join(mainFolderPath, subFolderName);

                    const fileButtons = readdirSync(subFolderPath).map(fileName => {
                        return [{ text: fileName, callback_data: `file_${fileName}` }];
                    });

                    if (fileButtons.length === 0) {
                        bot.sendMessage(chatId, `Subfolder ${subFolderName} is empty!`);
                        return;
                    }

                    const fileOptions = {
                        reply_markup: JSON.stringify({
                            inline_keyboard: fileButtons
                        })
                    };

                    bot.sendMessage(chatId, "Choose a file:", fileOptions).then(filesChoices => {
                        bot.once("callback_query", (fileCallbackQuery) => {
                            bot.deleteMessage(chatId, filesChoices.message_id).catch(error => {
                                console.error('Error deleting file message:', error);
                            });

                            const fileName = (fileCallbackQuery.message.reply_markup.inline_keyboard.find(buttonsFilter =>
                                buttonsFilter[0].callback_data === fileCallbackQuery.data
                            ))[0].text;

                            const filePath = join(subFolderPath, fileName);

                            const contentType = lookup(filePath); // returns 'audio/mpeg' for .mp3 files                            

                            const fileOptions = {
                                // Explicitly specify the file name.
                                filename: fileName,
                                // Explicitly specify the MIME type.
                                contentType
                            };

                            console.log(fileOptions);

                            bot.sendDocument(chatId, filePath, {}, fileOptions).then(() => {
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
    });
});


console.log("Bot is running...");
