const hummus = require('hummus');
const config = require('./config');

function PDFWStreamForBuffer()
{
    this.buffer = null;
    this.position = 0;
}

PDFWStreamForBuffer.prototype.write = function(inBytesArray)
{
    if(inBytesArray.length > 0)
    {
        if(!this.buffer)
        {
            this.buffer = Buffer.from(inBytesArray);
        }
        else
        {
            this.buffer = Buffer.concat([this.buffer, Buffer.from(inBytesArray)]);
        }
        this.position += inBytesArray.length;
        return inBytesArray.length;
    }
    return 0;
};

PDFWStreamForBuffer.prototype.getCurrentPosition = function()
{
    return this.position;
};

const symbolMark = "√";
const symbolCross = "×";	//✗✘✕✖🗴🗶

function pageCreator(func) {
	return (tpfile, args) => {
		let wstream = new PDFWStreamForBuffer();
		let pdfWriter = hummus.createWriterToModify(new hummus.PDFRStreamForFile(tpfile), wstream);
		let pageModifier = new hummus.PDFPageModifier(pdfWriter,0);
		const ctx = pageModifier.startContext().getContext();
		ctx.writer = pdfWriter;
		func(ctx, args);
		ctx.writer = undefined;
		pageModifier.endContext().writePage();
		pdfWriter.end();
		return wstream;
	}
}

let createTextPage = pageCreator((ctx, texts) => {
	textOptions = {font:ctx.writer.getFontForFile(config.fontpath + 'msyh.ttc'),size:14,colorspace:'gray',color:0x00};
	texts.forEach(v => {
		ctx.writeText(v.text, v.x, v.y, textOptions);
	});
});

let createContentPage = pageCreator((ctx, imagefile) => {
	ctx.drawImage(60, 55, imagefile, {transformation:{width:530, height:630, proportional:true}})
});

function genFC(data) {
	const d = new Date(data.examdate);
	let ta = [
		{text:data.name, x:141, y:244},
		{text:symbolMark, x:data.sex==='男' ? 141 : 213, y:202},
		{text:data.id, x:141, y:160},
		{text:d.getFullYear(), x:140, y:117},
		{text:d.getMonth()+1, x:208, y:117},
		{text:d.getDate(), x:250, y:117},
	];
	if (data.edscp.includes('无痛胃镜')) ta.push({text:symbolMark, x:141, y:76});
	if (data.edscp.includes('无痛肠镜')) ta.push({text:symbolMark, x:214, y:76});
	return createTextPage(config.tppath + 'tpfront.pdf', ta);
}

function genFC2(data) {
	const ys = [300,350,400,450,500];
	let ta = [];
	data.files.forEach((v, index) => {
		ta.push({text:v.length > 0 ? symbolMark : symbolCross, x:66, y:868-ys[index]});
	});
	return createTextPage(config.tppath + 'tpfront2.pdf', ta);
}

function makeReport(data, res) {
	let strmFC = genFC(data);
	let strmFC2 = genFC2(data);
	let wstream = new hummus.PDFStreamForResponse(res);
	let globalWriter = hummus.createWriter(wstream, {userPassword: '', ownerPassword: 'h3owner1', userProtectionFlag:4});
	globalWriter.appendPDFPagesFromPDF(new hummus.PDFRStreamForBuffer(strmFC.buffer));
	globalWriter.appendPDFPagesFromPDF(new hummus.PDFRStreamForBuffer(strmFC2.buffer));
	data.files.forEach((v, index) => {
		v.forEach(f => {
			let strm = createContentPage(config.tppath + `tp${index}.pdf`, config.filespath + f.id);
			globalWriter.appendPDFPagesFromPDF(new hummus.PDFRStreamForBuffer(strm.buffer));
		});
	});
	globalWriter.appendPDFPagesFromPDF(config.tppath + 'tpback.pdf');
	globalWriter.end();
}

exports.makeReport = makeReport;
