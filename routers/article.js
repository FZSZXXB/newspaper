let express = require('express');
let url = require("url");
let connection = require('./mysqldb');
let md = require('markdown-it')();
let fs = require("fs");
let path = require("path");
let { kill } = require('process');
//路由对象
let router = express.Router();
//中间件,未登录不能访问发表文章页面
function checklogin(req, res, next) {
	if (req.session.user) {
		next();
	} else {
		res.redirect('/loginPage');
	}
}
//文章内容页面
router.get('/:id/', function (req, res) {
	try {
		res.locals.user = req.session.user;
		let id = parseInt(req.params.id);
		connection.query(`SELECT * FROM article WHERE id = ${id}`, function (error, results, fields) {
			if (error)
				res.render('error', { error_code: 4002 });
			else {
				let readTime = results[0].content.length / 400;
				readTime = Math.round(readTime);
				if (readTime < 1) readTime = 1;
				let temp = results[0].content.replace(/&#39;/g,"\'");
				temp = temp.replace(/&quot;/g,"\"");
				temp =
					md.render(temp)
						.replace('<table>', '<table class="ui very basic unstackable table">')
						.replace(new RegExp('<img src=(.+) alt="">', 'g'), '<a href=$1 class="js_gallery_evaluate" data-fancybox="gallery" data-captain=$1><img src=$1 alt=""></a>');
				results[0].content = temp;
				res.render('article', {
					readTime: readTime,
					article: results[0]
				});
			}
		})
	} catch (e) {
		res.render('error', { error_code: 4002 });
	}
})

function listFiles(id) {
	try {
		let dir = `./data/${id}`;
		let list = fs.readdirSync(dir);
		return list;
	} catch (e) {
		console.log(e);
		return null;
	}
}

router.get('/:id/edit', checklogin, function (req, res) {
	try {
		// console.log(111);
		res.locals.user = req.session.user;
		let id = parseInt(req.params.id);
		connection.query(`SELECT * FROM article WHERE id = ${id}`, function (error, results, fields) {
			if (results.length === 0) {
				res.render('edit');
			} else {
				let files = listFiles(id);
				res.render('edit', {
					article: results[0],
					files: files
				});
			}
		});
	} catch (e) {
		res.render('edit', { error: e });
	}
})

router.post('/:id/edit', function (req, res) {
	try {
		res.setHeader('Content-Type', 'application/json');
		if (!req.session.user)
			throw 3001; // 未经授权
		else {
			let id = parseInt(req.params.id);
			console.log("id = " + id);
			if (req.body.title.length === 0) throw 3002; // 标题无效
			if (req.body.music_server.length >= 1 && req.body.music_id.length < 1) req.body.music_server = '';
			connection.query(`SELECT * FROM article WHERE id = ${id}`, function (error, results, fields) {
				let nowTime = web_util.getCurrentDate(true);
				let str = req.body.content;
				let temp = str.replace(/\'/g,"&#39;");
				temp = temp.replace(/\"/g,"&quot;");
				if (results.length === 0) {
					connection.query(`INSERT INTO article(title,create_time,update_time,description,content,music_server,music_id) \
										VALUES("${req.body.title}",${nowTime},${nowTime},"${req.body.description}","${temp}", "${req.body.music_server}", "${req.body.music_id}")`, function (error, rows) {
						if (error)
							res.send(JSON.stringify({ error_code: 3009, detail: error.message }));
						else 
							res.send(JSON.stringify({ error_code: 1, article_id: rows.insertId }));
					});
				} else {
					connection.query(`UPDATE article SET title="${req.body.title}",update_time=${nowTime},description="${req.body.description}",content="${temp}",music_server="${req.body.music_server}",music_id="${req.body.music_id}" WHERE id=${id}`, function (error, results, fields) {
						if (error)
							res.send(JSON.stringify({ error_code: 3009, detail: error.message }));
						else
						res.send(JSON.stringify({ error_code: 1, article_id: id }));
					});
				}
			});
		}
	} catch (e) {
		res.send(JSON.stringify({ error_code: e }));
	}
})

router.post('/:id/delete', function (req, res) {
	try {
		res.setHeader('Content-Type', 'application/json');
		let id = parseInt(req.params.id);
		connection.query(`delete from article where id=${id}`, function (error, results, fields) {
			if (error) throw error.message;
			else {
				fs.unlink(path.join('data', id), function (err) {
					if (err) throw err;
					console.log('File deleted!');
				});
				throw 'ok';
			}
		})
	} catch (e) {
		res.send(JSON.stringify({ error: e }));
	}
})
//导出路由对象
module.exports = router;