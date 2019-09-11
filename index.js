const path = require("path");
const fs = require("fs");
const globby = require('globby');
const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const config = require('./config');
const multer = require("multer");
const upload = multer({ dest: config.filespath });
const pdfgen = require('./pdfgen');

if (!fs.existsSync(config.filespath)){
    fs.mkdirSync(config.filespath);
}

const sql = require('mssql');
const pool1 = new sql.ConnectionPool(config.db);
const pool1Connect = pool1.connect();

pool1.on('error', err => {
});

const sqlstr = "select PatientID,XM1,XB1,ScheduleDate,SQMD FROM RITB1 left join RITB on RITB1.DJH1=RITB.DJH1 where PatientID=@pid";
const sqlstr2 = "select AccessionNo from RITB,RITB1 where RITB.DJH1=RITB1.DJH1 and PatientID=@pid";

async function messageHandler(pid, ss) {
    await pool1Connect; // ensures that the pool has been created
    try {
    	const request = new sql.Request(pool1)
        const result = await request.input("pid", pid).query(ss);
    	return result;
    } catch (err) {
        console.error('SQL error', err);
        throw err;
    }
}

const app = express();
const opts = {redirect: false};
app.use('/files/1', express.static(config.matpath[0], opts));
app.use('/files/2', express.static(config.matpath[1], opts));
app.use('/files/3', express.static(config.matpath[2], opts));
app.use('/files/4', express.static(config.matpath[3], opts));
app.use('/files/5', express.static(config.matpath[4], opts));
app.use(express.static(path.resolve(config.clipath)));
app.use(cors());
app.use(bodyParser.text());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

app.get("/api/query", function(req, res){
    let pid = req.query['pid'] || '';
    let f = async() => {
        try{
            let result = await messageHandler(pid, sqlstr);
            let result2 = await messageHandler(pid, sqlstr2);
            let patterns = [
                {pattern: [`**/${pid}*.jpg`,`**/${pid}*.pdf`], path: config.matpath[0]},
                {pattern: result2.recordset.map(v => `**/${v.AccessionNo}.jpg`), path: config.matpath[1]},
                {pattern: `**/${pid}*.jpg`, path: config.matpath[2]},
                {pattern: `**/${pid}*.jpg`, path: config.matpath[3]},
                {pattern: [`**/${pid}*.jpg`,`**/${pid}*.pdf`], path: config.matpath[4]},
            ];
            let files = patterns.map(mp => globby.sync(mp.pattern, {cwd:mp.path}).sort().reverse());
            console.log(files);
            res.status(200).json({info:result.recordset, files});
        } catch(err) {
            res.status(500).json(err);
        }
    };
    f();
});

app.post("/api/upload", upload.array("files", 12), function(req, res, next) {
	// req.files is array of `photos` files
	//console.log(req.files);
	// req.body will contain the text fields, if there were any
    //console.log(req.body);
	res.send(req.files[0].filename);
});

app.delete("/api/upload", function(req, res){
	fs.unlinkSync(config.filespath + req.body);
	res.status(200).end();
});

app.get("/api/upload", function(req, res){
    console.log(req.query);
	res.status(200).end();
});

app.post("/api/make", function(req, res){
    console.log(require('util').inspect(req.body, false, null, true));
    res.writeHead(200, {'Content-Type': 'application/pdf'});
    pdfgen.makeReport(req.body, res);
	res.end();
});

app.listen(config.port, () => {
    console.log("Server is running on port " + config.port + "...");
});
