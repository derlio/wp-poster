#!/usr/bin/env node
const lib = require('./lib.js')
const fs = require('fs')
const readline = require('readline')
const process = require('process')

var itemsFilePath = 'output/items.json'


/**
 * 读取wp后台用户名密码
 */
function readUsernameAndPwd() {
    console.log('Input your username and password');
    let rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });
    rl.question('Username:', function (username) {
        if (username == null || username.length == 0) {
            console.log('Username can not be empty.')
            process.exit(1);
        } else {
            rl.question('Password:', function (password) {
                if (password == null || password.length == 0) {
                    console.log('Password can not be empty.')
                    process.exit(1);
                } else {
                    lib.createWpApi(username, password);
                    loadItems(function (items) {
                        console.log('readlines: ' + items.length);
                        lib.startPublish(items);
                    });
                }
            })
        }
    });

}

/**
 * 加载本地数据
 * @param {*} callback 
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