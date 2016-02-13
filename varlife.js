"use strict";

var renderLoop = false;
$(function(){
	$('#tps').on('change', function(){
		$('#mspt').val(Math.round(1000/$('#tps').val()));
		if (renderLoop) { setRenderLoop(); }
	});
	$('#mspt').on('change', function(){
		$('#tps').val(Math.round(1000/$('#mspt').val()));
		if (renderLoop) { setRenderLoop(); }
	});
	
	$('#toroidal').on('change', function(){
		toroidalH = this.checked;
		toroidalV = this.checked;
		$('#toroidalH').prop('checked', toroidalH);
		$('#toroidalV').prop('checked', toroidalV);
	});
	$('#toroidalH').on('change', function(){
		toroidalH = this.checked;
		if (toroidalH && !$('#toroidal').prop('checked')) {
			$('#toroidal').prop('checked', true);
		} else if (!toroidalH && $('#toroidal').prop('checked') && !toroidalV) {
			$('#toroidal').prop('checked', false)
		}
	});
	$('#toroidalV').on('change', function(){
		toroidalV = this.checked;
		if (toroidalV && !$('#toroidal').prop('checked')) {
			$('#toroidal').prop('checked', true);
		} else if (!toroidalV && $('#toroidal').prop('checked') && !toroidalH) {
			$('#toroidal').prop('checked', false)
		}
	});
	
	$('#width').on('change', resize);
	$('#height').on('change', resize);
	$('#cellSize').on('change', resize);
	
	$('#rules').on('change', 'input', changeRules);
	$('#rules').on('click', '.rule', function(){
		$('.picked').removeClass('picked');
		$(this).addClass('picked');
	});
	$('#rules').on('change', 'input[type=checkbox]', function(){
		var R = RegExp('.*?([0-9]+).*?').exec($(this).attr('id'));
		var num = parseInt(R[1])-1;
		rules[num]['random'] = this.checked;
		$('#'+R[0]+'birthprob').prop("disabled", !this.checked);
		$('#'+R[0]+'surviveprob').prop("disabled", !this.checked);
		
		rules[num]['birthprob'] = this.checked ? parseFloat($('#'+R[0]+'birthprob').val()) : 1;
		rules[num]['surviveprob'] = this.checked ? parseFloat($('#'+R[0]+'surviveprob').val()) : 1; 
	});
	
	$('#field').on('mouseup', function(){ mouseDown = false; toggleTo = -1; });
	
	loadPermalink();
});

function setRenderLoop() {
	if (renderLoop) { clearInterval(renderLoop); }
	renderLoop = setInterval(update, fastMode ? 1 : $('#mspt').val());
}

function start() {
	if (steps === 0) { steps = -1; }
	setRenderLoop();
}
function stop() { clearInterval(renderLoop); renderLoop = false; }

var rules = [{'dead':'#000000', 'alive':'#FFFFFF', 'birth':[3], 'survive':[2,3], 'birthprob':1, 'surviveprob':1, 'random':false}];

var grid = [];
var gridW = 20;
var gridH = 20;
var cellSize = 10;

var savedGrid = [];
var savedW = 20;
var savedH = 20;

var toroidalV = false;
var toroidalH = false;

var steps = -1;
var generations = 0;

var fastMode = false;
var mouseDown = false;
var toggleTo = -1;

function initGrid() {
	grid = [];
	
	for (var j=0; j<gridH; j++) {
		var row = [];
		for (var i=0; i<gridW; i++) {
			row.push( [0,0,0] ); //rule number, current state, new state
			d3.select('#blocks').append('rect')
				.attr('x',i*cellSize)
				.attr('y',j*cellSize)
				.attr('width',cellSize)
				.attr('height',cellSize)
				.attr('fill', '#000000')
				.attr('stroke','#808080')
				.attr('stroke-width','1px')
				.attr('id','b_'+i+'_'+j)
				.attr('class','block')
				.on('mousedown', function(){
					mouseDown = true;
					d3.select(this).call(changeCell.bind(this));
				})
				.on('mouseover', changeCell)
		}
		grid.push(row);
	}
	
	d3.select('#field')
		.attr('width', cellSize*gridW)
		.attr('height', cellSize*gridH);
}

function clearGrid(resetRules) {
	for (var j=0; j<gridH; j++) {
		for (var i=0; i<gridW; i++) {
			if (resetRules) { grid[j][i][0] = 0; }
			grid[j][i][1] = 0;
			grid[j][i][2] = 0;
		}
	}
	generations = 0;
	steps = 0;
	updateGraphics();
	stop();
}

function update() {
	if (!renderLoop && !fastMode) { start(); }
	
	if (steps === 0) {
		clearInterval(renderLoop);
		renderLoop = false;
		fastMode = false;
	} else {
		generations += 1;
		steps -= 1;
		updateGrid();
		updateGraphics();
	}
}
function step(){steps = 1; update();}

function slow() {
	steps = $('#numSteps').val();
	start();
}
function fast(){
	fastMode = true;
	steps = parseInt($('#numSteps').val());
	while (fastMode) { update(); }
	updateGraphics();
}

function renderGif(){
	$('#renderGif').prop('disabled',true);
	$('#rendered-gif').prepend($('<p>Rendering...</p>'));
	
	fastMode = true;
	steps = parseInt($('#renderSteps').val());
	var gridData = [];
	var tempG;
	var row;
	
	saveGrid();
		
	tempG = [];
	for (var j=0; j<gridH; j++) {
		row = [];
		for (var i=0; i<gridW; i++) {
			row.push(grid[j][i][0]*2 + grid[j][i][1]);
		}
		tempG.push(row);
	}
	gridData.push(tempG);
	
	while (fastMode) {
		update();
		
		tempG = [];
		for (var j=0; j<gridH; j++) {
			row = [];
			for (var i=0; i<gridW; i++) {
				row.push(grid[j][i][0]*2 + grid[j][i][1]);
			}
			tempG.push(row);
		}
		gridData.push(tempG);
	}
	
	loadGrid();
	
	var colorData = [];
	for (var k=0; k<rules.length; k++) {
		colorData.push(rules[k]["dead"]);
		colorData.push(rules[k]["alive"]);
	}
	
	$.ajax({
		url: '/varlife/rendergif',
		type: 'post',
		data: {'gridData':JSON.stringify(gridData), 'colorData':JSON.stringify(colorData),
			   'width':gridW, 'height':gridH, 'cellSize':cellSize, 'frameDuration':$('#mspt').val()},
		dataType: 'html',
		success: function(response) {
			$('#renderGif').prop('disabled',false);
			console.log(response);
			$('#rendered-gif').children().remove();
			$('#rendered-gif').append($('<img src="/static/d3applets/renders/'+response+'"/>'));
		},
		failure: function(response) {
			$('#renderGif').prop('disabled',false);
			console.log(response);
			$('#rendered-gif').append($('<p>Something went wrong! :('));
		}
	});
}

function updateGrid() {
	for (var j=0; j<gridH; j++) {
		for (var i=0; i<gridW; i++) {
			var total = 0;
			
			for (var dj=-1; dj<2; dj++) {
				var j2 = j+dj;
				
				if (j2 < 0 || j2 >= gridH) {
					if (toroidalV) {
						j2 = (j2+gridH)%gridH;
					} else {
						continue;
					}
				}
				
				for (var di=-1; di<2; di++) {
					var i2 = i+di;
					
					if (i2 < 0 || i2 >= gridW) {
						if (toroidalH) {
							i2 = (i2+gridW)%gridW;
						} else {
							continue;
						}
					}
					
					if (di !== 0 || dj !== 0) {
						total += grid[j2][i2][1];
					}
				}
			}
			
			var cell = grid[j][i];
			var part = rules[cell[0]][cell[1] ? 'survive' : 'birth'];
			var prob = rules[cell[0]][cell[1] ? 'surviveprob' : 'birthprob'];
			
			cell[2] = 0;
			for (var k=0; k<part.length; k++) {
				if (total === part[k] && Math.random() < prob) {
					cell[2] = 1;
				}
			}
		}
	}
}

function updateGraphics() {
	for (var j=0; j<gridH; j++) {
		for (var i=0; i<gridW; i++) {
			var cell = grid[j][i];
			var rule = rules[cell[0]];
			
			if (!renderLoop) {
				d3.select("#blocks").select('#b_'+i+'_'+j).attr('fill', rule[cell[1] ? 'alive' : 'dead']);
			} else if (!fastMode && cell[1] !== cell[2]) {
				d3.select("#blocks").select('#b_'+i+'_'+j).attr('fill', rule[cell[2] ? 'alive' : 'dead']);
			}
			
			if (renderLoop || fastMode){ cell[1] = cell[2]; }
		}
	}
	
	$('#generationCounter').text(generations);
}

function changeCell() {
	if (!mouseDown){ return; }
	
	var coords = d3.select(this).attr('id').split('_').map(Number);
	var cell = grid[coords[2]][coords[1]];
	var which = $('input[name="paintKind"]:checked').val();
	
	if (which === "toggle") {
		if (toggleTo+1) {
			cell[1] = toggleTo;
		} else {
			cell[1] = 1 - cell[1];
			toggleTo = cell[1];
		}
	} else if (which === "paint") {
		var num = parseInt($('.picked:first').attr('id').substr(4,100));
		cell[0] = num-1;
	}
	
	var rule = rules[cell[0]];
	d3.select(this).attr('fill', rule[cell[1] ? 'alive' : 'dead']);
}

function resize() {
	var cs = parseInt($('#cellSize').val());
	if (cs !== cellSize) {
		cellSize = cs;
		for (var j=0; j<gridH; j++) {
			for (var i=0; i<gridW; i++) {
				d3.select('#b_'+i+'_'+j)
					.attr('x',i*cs)
					.attr('y',j*cs)
					.attr('width',cs)
					.attr('height',cs)
			}
		}
		d3.select('#field')
			.attr('width', cs*gridW)
			.attr('height', cs*gridH);
			
	} else {
		var oldGrid = $.extend(true, [], grid);
		var oldW = gridW;
		var oldH = gridH;
		
		gridW = parseInt($('#width').val());
		gridH = parseInt($('#height').val());
		
		d3.selectAll(".block").remove();
		initGrid();
		
		for (var j=0; j<Math.min(oldH,gridH); j++) {
			for (var i=0; i<Math.min(oldW,gridW); i++) {
				for (var k=0; k<3; k++) {
					grid[j][i][k] = oldGrid[j][i][k];
				}
			}
		}
		
		updateGraphics();
	}
}

function saveGrid() {
	savedGrid = $.extend(true, [], grid);
	savedW = gridW;
	savedH = gridH;
}

function loadGrid() {
	gridW = savedW;
	gridH = savedH;
	
	d3.selectAll(".block").remove();
	initGrid();
	
	for (var j=0; j<Math.min(savedH,gridH); j++) {
		for (var i=0; i<Math.min(savedW,gridW); i++) {
			for (var k=0; k<3; k++) {
				grid[j][i][k] = savedGrid[j][i][k];
			}
		}
	}
	
	if (renderLoop) {
		// updateGrid();
	} else {
		updateGraphics();
	}
}

var regex = new RegExp('.*([0-9]+)(.*)');
function changeRules() {
	var R = regex.exec($(this).attr('id'));
	var num = R[1]-1;
	var kind = R[2];
	
	if (kind === "text") {
		var s = $(this).val().split('/').map(function(x){ return x.substr(1,x.length-1).split('').map(Number); });
		rules[num]["birth"] = s[0];
		rules[num]["survive"] = s[1];
	} else if (kind === "alive" || kind === "dead") {
		rules[num][kind] = $(this).val();
		$(this).attr("value",$(this).val());
		var newCol;
		
		if ($(this).val() === "#") {
			newCol = $(this).val();
		} else {
			newCol = colorNameToHex($(this).val());
		}
		if (!newCol) { newCol = "#000000"; }
		
		$('#'+$(this).attr('id')+'color').val(newCol);
		$('#'+$(this).attr('id')+'color').attr("value",newCol);
		
		if (!renderLoop){ updateGraphics(); }
	} else if (kind === "alivecolor" || kind === "deadcolor") {
		rules[num][kind.substring(0,kind.length-5)] = $(this).val();
		$(this).attr("value",$(this).val());
		
		$('#'+R[0].substring(0,R[0].length-5)).val($(this).val());
		$('#'+R[0].substring(0,R[0].length-5)).attr("value",$(this).val());
		
		if (!renderLoop){ updateGraphics(); }
	} else if (kind === "birthprob" || kind === "surviveprob") {
		rules[num]['birthprob'] = parseFloat($('#'+R[0]).val());
		rules[num]['surviveprob'] = parseFloat($('#'+R[0]).val());
	}
}

function addRule(append) {
	var n = (append+1) ? append : rules.length+1;
	
	var div = $('.rule:last').clone();
	div.removeClass('picked');
	div.attr('id','rule'+n);
	
	var R = new RegExp('(id=".*?)'+(n-1)+'(.*?")', 'g'); //these two lines do a find-and-replace on rules[n-1]whatever -> rules[n]whatever
	div.html( div.html().replace(R, '$1'+n+'$2') );
	
	$('#rules').append(div);
	$('#rule'+n+'random').prop('checked', $('#rule'+(n-1)+'random').prop('checked') )
	
	if (append == -1){ rules.push( $.extend(true, {}, rules[rules.length-1]) ); } //http://stackoverflow.com/a/5164215/1473772
}

function removeRule() {
	//
}


function setPermalink() {
	//
	var data = {};
	data['rules'] = rules;
	data['mspt'] = $('#mspt').val();
	data['width'] = gridW;
	data['height'] = gridH;
	data['cellSize'] = cellSize;
	data['toroidalH'] = toroidalH;
	data['toroidalV'] = toroidalV;
	
	var gridNums = [];
	var gridNum = 0;
	var blockNum = 0;
	for (var j=gridH-1; j>-1; j--) {
		for (var i=gridW-1; i>-1; i--) {
			if (gridNum * 2*rules.length > Math.pow(2,24)) {
				gridNums.push(blockNum);
				gridNums.push(gridNum);
				blockNum = 0;
				gridNum = 0;
			}
			
			blockNum += 1;
			gridNum *= 2;
			gridNum += grid[j][i][1];
			gridNum *= rules.length;
			gridNum += grid[j][i][0];
		}
	}
	gridNums.push(blockNum);
	gridNums.push(gridNum);
	
	data['gridNums'] = gridNums;
	var dataString = JSON.stringify(data);
	location.hash = '#data='+dataString;
	$('#permalink').attr('href','#data='+dataString);
}

function loadPermalink() {
	if (!location.hash || location.hash === '#'){ initGrid(); return; }
	
	var dataString = decodeURI(location.hash).slice(6);
	var data = JSON.parse(dataString);
	
	$('#mspt').val(data['mspt']);
	$('#tps').val(Math.round(1000/data['mspt']));
	
	toroidalH = data['toroidalH'];
	toroidalV = data['toroidalV'];
	$('#toroidalH').prop('checked', toroidalH);
	$('#toroidalV').prop('checked', toroidalV);
	$('#toroidal').prop('checked', toroidalH || toroidalV);
	
	rules = data['rules'];
	var tempRule = $('.rule:first').detach();
	$('#rules').empty();
	$('#rules').append(tempRule);
	
	for (var k=0; k<rules.length; k++) {
		if (k){ addRule(k+1); }
		var prefix = '#rule'+(k+1);
		var rule = rules[k];
		
		$(prefix+'text').val('B'+rule['birth'].join('')+'/S'+rule['survive'].join(''));
		
		var a = rule['alive'];
		$(prefix+'alive').val(a);
		$(prefix+'alive').attr('value',a);
		$(prefix+'alivecolor').val(colorNameToHex(a) || a);
		$(prefix+'alivecolor').attr('value',colorNameToHex(a) || a);
		
		var d = rule['dead'];
		$(prefix+'dead').val(d);
		$(prefix+'dead').attr('value',d);
		$(prefix+'deadcolor').val(colorNameToHex(d) || d);
		$(prefix+'deadcolor').attr('value',colorNameToHex(d) || d);
		
		$(prefix+'random').prop('checked', rule['random']);
		$(prefix+'birthprob').prop('disabled', !rule['random']);
		$(prefix+'surviveprob').prop('disabled', !rule['random']);
		$(prefix+'birthprob').val(rule['birthprob']);
		$(prefix+'surviveprob').val(rule['surviveprob']);
	}
	$('.rule:first').addClass('picked');
	
	gridW = data['width'];
	gridH = data['height'];
	cellSize = data['cellSize'];
	$('#width').val(gridW);
	$('#height').val(gridH);
	$('#cellSize').val(cellSize);
	
	d3.selectAll('.block').remove();
	initGrid();
	var blockNum;
	var gridNum;
	
	var i = 0;
	var j = 0;
	while (data['gridNums'].length) {
		gridNum = data['gridNums'].pop();
		blockNum = data['gridNums'].pop();
		
		for (var k=0; k<blockNum; k++) {
			grid[j][i][0] = gridNum % rules.length;
			gridNum = (gridNum - grid[j][i][0]) / rules.length;
			grid[j][i][1] = gridNum % 2;
			gridNum = (gridNum - grid[j][i][1]) / 2;
			
			i += 1;
			if (i >= gridW){ j += 1; i=0; }
		}
	}
	
	updateGraphics();
}

///////////

function colorNameToHex(color) //http://stackoverflow.com/a/1573141/1473772
{
    var colors = {"aliceblue":"#f0f8ff","antiquewhite":"#faebd7","aqua":"#00ffff","aquamarine":"#7fffd4","azure":"#f0ffff",
    "beige":"#f5f5dc","bisque":"#ffe4c4","black":"#000000","blanchedalmond":"#ffebcd","blue":"#0000ff","blueviolet":"#8a2be2","brown":"#a52a2a","burlywood":"#deb887",
    "cadetblue":"#5f9ea0","chartreuse":"#7fff00","chocolate":"#d2691e","coral":"#ff7f50","cornflowerblue":"#6495ed","cornsilk":"#fff8dc","crimson":"#dc143c","cyan":"#00ffff",
    "darkblue":"#00008b","darkcyan":"#008b8b","darkgoldenrod":"#b8860b","darkgray":"#a9a9a9","darkgreen":"#006400","darkkhaki":"#bdb76b","darkmagenta":"#8b008b","darkolivegreen":"#556b2f",
    "darkorange":"#ff8c00","darkorchid":"#9932cc","darkred":"#8b0000","darksalmon":"#e9967a","darkseagreen":"#8fbc8f","darkslateblue":"#483d8b","darkslategray":"#2f4f4f","darkturquoise":"#00ced1",
    "darkviolet":"#9400d3","deeppink":"#ff1493","deepskyblue":"#00bfff","dimgray":"#696969","dodgerblue":"#1e90ff",
    "firebrick":"#b22222","floralwhite":"#fffaf0","forestgreen":"#228b22","fuchsia":"#ff00ff",
    "gainsboro":"#dcdcdc","ghostwhite":"#f8f8ff","gold":"#ffd700","goldenrod":"#daa520","gray":"#808080","green":"#008000","greenyellow":"#adff2f",
    "honeydew":"#f0fff0","hotpink":"#ff69b4",
    "indianred ":"#cd5c5c","indigo":"#4b0082","ivory":"#fffff0","khaki":"#f0e68c",
    "lavender":"#e6e6fa","lavenderblush":"#fff0f5","lawngreen":"#7cfc00","lemonchiffon":"#fffacd","lightblue":"#add8e6","lightcoral":"#f08080","lightcyan":"#e0ffff","lightgoldenrodyellow":"#fafad2",
    "lightgrey":"#d3d3d3","lightgreen":"#90ee90","lightpink":"#ffb6c1","lightsalmon":"#ffa07a","lightseagreen":"#20b2aa","lightskyblue":"#87cefa","lightslategray":"#778899","lightsteelblue":"#b0c4de",
    "lightyellow":"#ffffe0","lime":"#00ff00","limegreen":"#32cd32","linen":"#faf0e6",
    "magenta":"#ff00ff","maroon":"#800000","mediumaquamarine":"#66cdaa","mediumblue":"#0000cd","mediumorchid":"#ba55d3","mediumpurple":"#9370d8","mediumseagreen":"#3cb371","mediumslateblue":"#7b68ee",
    "mediumspringgreen":"#00fa9a","mediumturquoise":"#48d1cc","mediumvioletred":"#c71585","midnightblue":"#191970","mintcream":"#f5fffa","mistyrose":"#ffe4e1","moccasin":"#ffe4b5",
    "navajowhite":"#ffdead","navy":"#000080",
    "oldlace":"#fdf5e6","olive":"#808000","olivedrab":"#6b8e23","orange":"#ffa500","orangered":"#ff4500","orchid":"#da70d6",
    "palegoldenrod":"#eee8aa","palegreen":"#98fb98","paleturquoise":"#afeeee","palevioletred":"#d87093","papayawhip":"#ffefd5","peachpuff":"#ffdab9","peru":"#cd853f","pink":"#ffc0cb","plum":"#dda0dd","powderblue":"#b0e0e6","purple":"#800080",
    "red":"#ff0000","rosybrown":"#bc8f8f","royalblue":"#4169e1",
    "saddlebrown":"#8b4513","salmon":"#fa8072","sandybrown":"#f4a460","seagreen":"#2e8b57","seashell":"#fff5ee","sienna":"#a0522d","silver":"#c0c0c0","skyblue":"#87ceeb","slateblue":"#6a5acd","slategray":"#708090","snow":"#fffafa","springgreen":"#00ff7f","steelblue":"#4682b4",
    "tan":"#d2b48c","teal":"#008080","thistle":"#d8bfd8","tomato":"#ff6347","turquoise":"#40e0d0",
    "violet":"#ee82ee",
    "wheat":"#f5deb3","white":"#ffffff","whitesmoke":"#f5f5f5",
    "yellow":"#ffff00","yellowgreen":"#9acd32"};

    if (typeof colors[color.toLowerCase()] != 'undefined')
        return colors[color.toLowerCase()];

    return false;
}
