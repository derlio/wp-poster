const WPAPI = require( 'wpapi' );

// 文章内容模板
const imageTemplate = '<img class="alignnone size-full" src="IMAGE_PLACEHOLDER" />';
const hideTitleTemplate = '<strong><span style="color: #ff0000;">完整解说文案（word文档）、影片下载地址请查看附件↓↓↓</span></strong>'
const hideContentTemplate = '<strong>[rihide] </strong>' +
    '<strong>解说文案：<a href="DOCX_PLACEHOLDER">下载链接</a> </strong>' +
    '<p></p>' +
    '<strong><strong>影片迅雷下载链接：<a href="MOVIE_PLACEHOLDER">下载链接</a></strong></strong>' +
    '<strong>[/rihide]</strong>';

const WP_ENDPOINT = "http://www.99jieshuo.com//wp-json";

//网站已有分类
var categoriesMap = new Map();


var wp = {}  //wp api实例
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
     if (line == null) {
         console.log('No more post to be published.')
         return;
     }
     publishPost(item, function(success) {
        if (!success) {
            console.log(item.title + " publish failed.");
        }
        prepareNextPost();
     });
 }

function publishPost(item, callback) {
    if (categoriesMap.length > 0) {
        publishPostInternal(buildPost(item), callback);
    } else {
        fetchCategories(function(){
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
 * 构建文章
 * @param {*} item 
 */
function buildPost(item) {
        post = {
            title: item.title,
            categories: [categoriesMap.get(item.category)],
            status: 'publish',
            content: buildContent2(item)
        };
}

function buildContent2(item) {
    content += imageTemplate.replace('IMAGE_PLACEHOLDER', item.imageUrl);
    content += item.desc;
    content += hideTitleTemplate;
    content += hideContentTemplate.replace('DOCX_PLACEHOLDER', item.docUrl).replace('MOVIE_PLACEHOLDER', item.movie_url);
    return content;
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
    wp.media().file(file).create().then(function (response) {
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
function publishPostInternal(post, callback) {
    if (post.content == null) {
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

module.exports.createWpApi = createWpApi
module.exports.startPublish = startPublish