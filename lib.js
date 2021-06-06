const WPAPI = require('wpapi');
const fs = require('fs');
const { title } = require('process');

// 文章内容模板
const imageTemplate = '<img class="alignnone size-full" src="IMAGE_PLACEHOLDER" /><br/>';
const hideTitleTemplate = '<strong><span style="color: #ff0000;">完整解说文案（word文档）、影片下载地址请查看附件↓↓↓</span></strong>'
const hideContentTemplate = '[rihide]' +
    '<strong>解说文案：<a href="DOCX_PLACEHOLDER">下载链接</a> </strong>' +
    '<p></p>' +
    '<strong>影片迅雷下载链接：<a href="MOVIE_PLACEHOLDER">下载链接</a></strong>' +
    '[/rihide]';

const WP_ENDPOINT = "http://www.99jieshuo.com//wp-json";

//网站已有分类
var categoriesMap = new Map();

//网站已有文章的所有标题
var postTitlesSet = new Set();


var wp = {} //wp api实例
var readyItems = [];
/**
 * 创建WPAPI
 * @param {用户名} name 
 * @param {密码} pwd 
 */
function createWpApi(name, pwd) {
    wp = new WPAPI({
        endpoint: WP_ENDPOINT,
        username: name,
        password: pwd,
    });
}

function startPublish(items) {
    if (items == null || items.length == 0) {
        console.log('Items is empty, abort.')
        return;
    }
    readyItems = items;
    prepareNextPost();
}

/**
 * 准备文章进行发布
 */
var publishIndex = 1;

function prepareNextPost() {
    console.log('Prepare next post...' + (publishIndex++))

    //取出数据中的第一个元素，每一个元素代码对应一篇文章
    let item = readyItems.shift();
    if (item == null) {
        console.log('No more post to be published.')
        return;
    }
    if (postTitlesSet.has(item.title)) {
        console.log('Post already published, slip.');
        prepareNextPost();
        return;
    }
    let zipFile = 'zips/' + item.title + '.zip';
    if (!fs.existsSync(zipFile)) {
        console.log('Post local zip not found, slip.');
        prepareNextPost();
        return;
    }
    publishMedia(zipFile, function(url){
        if (url == '') {
            console.log('zipFile upload failed, skip.');
            prepareNextPost();
            return;
        }
        item.fileUrl = url;

        let image_url = item.image_url;
        let image_file = 'images2/' + image_url.substring(image_url.lastIndexOf('/') + 1, image_url.lastIndexOf('.')) + '.png';
        if (!fs.existsSync(image_file)) {
            console.log('Image file not found, slip.');
            prepareNextPost();
            return;
        }
        publishMedia(image_file, function(url){
            item.image_url = url;
            publishPost(item, function (success) {
                if (!success) {
                    console.log(item.title + " publish failed.");
                }
                console.log('Publishing post done.');

                prepareNextPost();
            });
        })
    })
    
}

function publishPost(item, callback) {
    console.log('Publishing post: ' + item.title);
    if (categoriesMap.size > 0) {
        publishPostInternal(buildPost(item), callback);
    } else {
        fetchCategories(function () {
            publishPostInternal(buildPost(item), callback);
        });
    }
}

/**
 * 获取所有分类，添加到map中
 * @param {*} callback 
 */
function fetchCategories(callback) {
    console.log('Fetching categories...')
    wp.categories().then(function (data) {
        data.forEach(function (item) {
            categoriesMap.set(item.name, item.id);
        })
        callback();
    }).catch(function (error) {
        console.log(error.message);
        process.exit(1);
    });
}

/**
 * 构建文章
 * @param {*} item 
 */
function buildPost(item) {
    let categories = matchCategories(item.categories);
    if (categories == null || categories == '') {
        console.log('Categories not match.')
        return null;
    }
    return post = {
        title: categories + "《" + item.title + "》解说文案/片源下载",
        categories: [categoriesMap.get(categories)],
        status: 'publish',
        content: buildContent2(item)
    };
}

function buildContent2(item) {
    let content = '';
    content += imageTemplate.replace('IMAGE_PLACEHOLDER', item.image_url);
    content += item.desc + '<br/>';
    content += hideTitleTemplate;
    content += hideContentTemplate.replace('DOCX_PLACEHOLDER', item.fileUrl).replace('MOVIE_PLACEHOLDER', item.movie_url);
    return content;
}

/**
 * 发布文章
 * @param {*} post 
 */
function publishPostInternal(post, callback) {
    if (post == null || post.content == null) {
        console.log('post content is null, skip.');
        callback(false);
    } else {
        wp.posts().create(post).then(function (response) {
            console.log('id:' + response.id + ', status:' + response.status);
            callback(true);
        }).catch(error => {
            console.log(error);
            callback(false);
        })
    }
}

/**
 * 构建文章内容
 * @param {*} item 
 * @param {*} callback 
 * @returns 
 * @deprecated
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
    publishMedia(imageFile, function (url) {
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
                publishMedia(docFile, function (url) {
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
    console.log('Uploading ' + file);
    wp.media().file(file).create().then(function (response) {
        callback(response.source_url);
    }).catch(error => {
        callback(null)
        console.log(error)
    })
}

async function fetchAllPostTitles(callback) {
    console.log("Fetching all post titles...");
    try {
        for (let i = 1; i < 10000; i++) {
            console.log("-----page:" + i);
            let data = await fetchPostTitlesPerPage(i);
            if (data != null) {
                for(let j = 0; j<data.length; j++) {
                    let title = data[j].title.rendered;
                    let movieName = title.substring(title.indexOf("《") + 1, title.indexOf("》"));
                    postTitlesSet.add(movieName);
                }
            }
        }
    } catch (e) {
        console.log("Fetching all post titles done.");
        callback();
        let content = "";
        for(let name of postTitlesSet) {
            content += name + "\n";
        }
        fs.writeFile("posts.txt", content, function(err) {
            if (err) throw err;
        })
    }
}

async function fetchPostTitlesPerPage(page) {
    return new Promise((resolve, reject) => {
        wp.posts().perPage(100).page(page).then(function (data) {
            resolve(data);
        }).catch((err) => {
            reject(err);
        })
    })
}

function matchCategories(categories) {
    for(let key of categoriesMap.keys()) {
        let array = categories.split('/');
        if (array == null || array.length == 0) {
            return '';
        }
        for(let i=0; i<array.length; i++) {
            if (key.includes(array[i])){
                return key;
            }
        }
    }
    return '';
}



module.exports.createWpApi = createWpApi
module.exports.startPublish = startPublish
module.exports.fetchAllPostTitles = fetchAllPostTitles
module.exports.matchCategories = matchCategories
module.exports.fetchCategories = fetchCategories
module.exports.buildcontent2 = buildContent2