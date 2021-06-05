#!/usr/bin/env node

const lib = require('./lib.js')
const fs = require('fs')
const readline = require('readline')
const process = require('process')

var itemsFilePath = '/Users/Derlio/Develop/Github/private/wppublish/item.json'


/**
 * 读取wp后台用户名密码
 */
function readUsernameAndPwd() {
    fs.readFile('account.conf', 'utf-8', (err, data) => {
        if (err) throw err;
        let config = JSON.parse(data);
        lib.createWpApi(config.username, config.password);
        lib.fetchAllPostTitles(() => {
            loadItems2();
        });
    });
}

function loadItems2() {
    fs.readFile(itemsFilePath, 'utf-8', function (err, data) {
        if (err) {
            throw err;
        }
        lib.fetchCategories(() => {
            let items = JSON.parse(data);
            lib.startPublish(items);
        })
    })
}

/**
 * 加载本地数据
 * @param {*} callback 
 * @deprecated
 */
function loadItems(callback) {

    fs.access(itemsFilePath, fs.constants.F_OK, (err) => {
        if (err) {
            console.log('items.json not found.');
            process.exit(1);
        }

        var items = new Array();
        const fileStream = fs.createReadStream(itemsFilePath);
        const rl = readline.createInterface({
            input: fileStream,
            crlfDelay: Infinity
        });

        rl.on('line', (line) => {
            items.push(JSON.parse(line));
        });

        rl.on('close', function () {
            callback(items);
        })
    })

}





/**
 * 程序入口
 **/
readUsernameAndPwd();