#!/usr/bin/env node
const fs = require('fs')
const readline = require('readline')
const process = require('process')
var WPAPI = require( 'wpapi' );

var itemsFilePath = 'output/items.json'

// 文章内容模板
var imageTemplate = '<img class="alignnone size-full" src="IMAGE_PLACEHOLDER" />';
var hideTitleTemplate = '<strong><span style="color: #ff0000;">完整解说文案（word文档）、影片下载地址请查看附件↓↓↓</span></strong>'
var hideContentTemplate = '<strong>[rihide] </strong>' + 
    '<strong>解说文案：<a href="DOCX_PLACEHOLDER">下载链接</a> </strong>' + 
    '<p></p>' + 
    '<strong><strong>影片迅雷下载链接：<a href="MOVIE_PLACEHOLDER">下载链接</a></strong></strong>' + 
    '<strong>[/rihide]</strong>';

var itemsLine = new Array();
var categoriesMap = new Map();

var wp = {}

/**
 * 读取wp后台用户名密码
 */
function readUsernameAndPwd() {
    console.log('Input your username and password');
    let rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
      });
    rl.question('Username:', function(username) {
        if (username == null || username.length == 0) {
            console.log('Username can not be empty.')
            process.exit(1);
        } else {
            rl.question('Password:', function(password) {
                if (password == null || password.length == 0) {
                    console.log('Password can not be empty.')
                    process.exit(1);
                } else {
                    createWpApi(username, password);
                    loadItems(function(){
                        console.log('readlines: ' + itemsLine.length);
                        fetchCategories(function(){
                            prepareNextPost();
                        })
                    });
                }
            })
        }
    });

}

/**
 * 创建WPAPI
 * @param {用户名} name 
 * @param {密码} pwd 
 */
function createWpApi(name, pwd) {
    wp = new WPAPI({
        endpoint: 'http://www.99jieshuo.com//wp-json',
        username: name,
        password: pwd,
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
        const fileStream = fs.createReadStream(itemsFilePath);
            const rl = readline.createInterface({
                input: fileStream,
                crlfDelay: Infinity
              });
              
              rl.on('line', (line) => {
                itemsLine.push(line);
              });

              rl.on('close', function() {
                callback()
              })
    })
    
}

/**
 * 获取所有分类，添加到map中
 * @param {*} callback 
 */
function fetchCategories(callback) {
    console.log('Fetching categories...')
    wp.categories().then(function(data){
        data.forEach(function(item){
            categoriesMap.set(item.name, item.id);
        })
        callback();
    }).catch(function(error){
        console.log(error.message);
        process.exit(1);
    });
}

/**
 * 准备文章进行发布
 */
var publishIndex = 1;
function prepareNextPost() {
    console.log('Prepare next post...' + (publishIndex++))
    
    //取出数据中的第一个元素，每一个元素代码对应一篇文章
    let line = itemsLine.shift();
    if (line == null) {
        console.log('No more post to be published.')
        return;
    }
    let item = JSON.parse(line);
    buildPost(item)
}

/**
 * 构建文章
 * @param {*} item 
 */
function buildPost(item) {
    buildContent(item, function(content){
        let post = {};
        post.title = item.title;
        post.categories = [categoriesMap.get(item.category)];
        post.status = 'publish';
        post.content = content;
        publishPost(post);
    })
}

/**
 * 构建文章内容
 * @param {*} item 
 * @param {*} callback 
 * @returns 
 */
function buildContent(item, callback) {
    let imageFile = null
    var content = ''
    if (item.image_paths.length > 0) {
        imageFile = item.image_paths[0]
    }

    if (imageFile == null) {
        console.log('Image path is null, skip.')
        return;
    }
    publishMedia(imageFile, function(url){
        let imageUrl = url;
        var docFile = null;
        if (item.file_paths.length > 0) {
            docFile = item.file_paths[0]
        }

        if (docFile == null) {
            console.log('Doc path is null, skip.')
            return;
        }
        docFile = docFile.replace('docs', 'docs2');
        fs.access(docFile, fs.constants.F_OK, (err) => {
            if (err) {
                callback(null);
            } else {
                publishMedia(docFile, function(url){
                    if (url != null) {
                        let docUrl = url;
                        content += imageTemplate.replace('IMAGE_PLACEHOLDER', imageUrl);
                        content += item.desc;
                        content += hideTitleTemplate;
                        content += hideContentTemplate.replace('DOCX_PLACEHOLDER', docUrl).replace('MOVIE_PLACEHOLDER', item.movie_url);
                        callback(content);
                    } else {
                        callback(null);
                    }
                    
                })
            }
        })
    })
}

/**
 * 发布media对象，包括图片和文件
 * @param {*} file 
 * @param {*} callback 
 */
function publishMedia(file, callback) {
    wp.media().file(file).create().then(function(response) {
        callback(response.source_url);
    }).catch(error => {
        callback(null)
        console.log(error)
    })
}

/**
 * 发布文章
 * @param {*} post 
 */
function publishPost(post) {
    if (post.content == null) {
        console.log('post content is null, skip.');
        prepareNextPost();
    } else {
        wp.posts().create(post).then(function(response){
            console.log('id:' + response.id + ', status:' + response.status);
            prepareNextPost();
        }).catch(error => {
            console.log(error);
        })
    }
}

/**
 * 程序入口
 **/
readUsernameAndPwd();