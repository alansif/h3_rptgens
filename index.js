const path = require("path");
const fs = require("fs");
const globby = require('globby');
const compression = require('compression');
const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const config = require('./config');
const multer = require("multer");
const upload = multer({ dest: config.filespath });
//const pdfgen = require('./pdfgen');

const https = require("https");
const httpsOption = {
    key : fs.readFileSync("./https/2_report.huasanclinic.com.key"),
    cert: fs.readFileSync("./https/1_report.huasanclinic.com_bundle.crt")
}

if (!fs.existsSync(config.filespath)){
    fs.mkdirSync(config.filespath);
}

const sql = require('mssql');
const { query } = require("express");
const pool1 = new sql.ConnectionPool(config.db);
const pool1Connect = pool1.connect();

pool1.on('error', err => {
});

const sqlstr = "select RITB1.DJH1,AccessionNo,PatientID,XM1,XB1,ScheduleDate,StudyTime,StudyUser,SQMD FROM RITB1 left join RITB on RITB1.DJH1=RITB.DJH1 where StudyStatus in ('已审核','已报告') and ";
const sqlstr2 = "select AccessionNo from RITB,RITB1 where RITB.DJH1=RITB1.DJH1 and StudyStatus in ('已审核','已报告') and ";
const qid = "PatientID = @q";
const qname = "XM1 = @q";
const qdate = "ScheduleDate = @q";

async function messageHandler(p, ss) {
    await pool1Connect; // ensures that the pool has been created
    try {
        const request = new sql.Request(pool1);
        const result = await request.input("q", p).query(ss);
    	return result;
    } catch (err) {
        console.error('SQL error', err);
        throw err;
    }
}

const app = express();

app.use(compression({ filter: shouldCompress, level: 0 }));

function shouldCompress (req, res) {
    if (!!res.outputpdf) {
      return true
    }
    // fallback to standard filter function
    return compression.filter(req, res)
}

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
    let p;
    let str;
    if (req.query['pid']) {
        p = req.query['pid'];
        str = qid;
    } else if (req.query['pname']) {
        p = req.query['pname'];
        str = qname;
    } else if (req.query['pdate']) {
        p = req.query['pdate'];
        str = qdate;
    } else {
        res.status(400).end();
        return;
    }
    let f = async() => {
        try{
            let result = await messageHandler(p, sqlstr + str);
            let result2 = await messageHandler(p, sqlstr2 + str);
            const pid = req.query['pid'] || 0;
            let patterns = [
                {pattern: [`**/${pid}*.jpg`,`**/${pid}*.pdf`], path: config.matpath[0]},
                {pattern: result2.recordset.map(v => `**/${v.AccessionNo}.jpg`), path: config.matpath[1]},
                {pattern: `**/${pid}*.jpg`, path: config.matpath[2]},
                {pattern: `**/${pid}*.jpg`, path: config.matpath[3]},
                {pattern: [`**/${pid}*.jpg`,`**/${pid}*.pdf`], path: config.matpath[4]},
            ];
            let files = patterns.map(mp => globby.sync(mp.pattern, {cwd:mp.path, caseSensitiveMatch: false}).sort().reverse());
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
/*
app.post("/api/make", function(req, res){
    console.log(require('util').inspect(req.body, false, null, true));
//    res.outputpdf = true; //开了压缩慢很多
    pdfgen.makeReport(req.body, res);
    res.end();
});
*/
/*
app.listen(config.port, () => {
    console.log("Server is running on port " + config.port + "...");
});
*/
const server = https.createServer(httpsOption, app);
server.listen(config.port, function(){
    console.log("Server is running on port " + config.port + "...");
});
