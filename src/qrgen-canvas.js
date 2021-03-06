/**
 * JSQRGen: QRCode Canvas Renderer
 * @author Gerald <i@gerald.top>
 * @license MIT
 */

function QRCanvas(options) {
  this.m_init(options);
}

// rendering functions
QRCanvas.m_effects = {};
QRCanvas.m_colorDark = 'black';
QRCanvas.m_colorLight = 'white';

QRCanvas.prototype.m_init = function (options) {
  var _this = this;
  options = _this.m_options = assign({
    // typeNumber belongs to 1..40
    // will be increased to the smallest valid number if too small
    typeNumber: 1,

    // correctLevel can be 'L', 'M', 'Q' or 'H'
    correctLevel: 'M',

    // cellSize is preferred to size
    // if none is provided, use default values below
    // * cellSize: 2,
    // * size: cellSize * count,

    // foreground and background may be an image or a style string
    // or an array of objects with attributes below:
    // * row | x: default 0
    // * col | y: default 0
    // * cols | width: default size
    // * rows | height: default size
    // * style: default 'black'
    foreground: QRCanvas.m_colorDark,
    background: null,

    // data MUST be a string
    data: '',

    // effect: {key: [round|liquid], value: 0-0.5}
    effect: {},

    // Remove alpha channel to make the image not transparent
    noAlpha: true,

    // Null or a canvas to be reused
    reuseCanvas: null,

    /**
     * an image or text can be used as a logo
     * logo: {
     *   // image
     *   image: Image,

     *   // text
     *   text: string,
     *   color: string, default 'black'
     *   fontStyle: string, e.g. 'italic bold'
     *   fontFamily: string, default 'Cursive'

     *   // common
     *   clearEdges: number, default 0
     *       0 - not clear, just margin
     *       1 - clear incomplete cells
     *       2 - clear a larger rectangle area
     *   margin: number, default 2 for text and 0 for image
     *   size: float, default .15 stands for 15% of the QRCode
     * }
     */
    // logo: {},
  }, options);
  var logo = _this.m_logo = {
    color: QRCanvas.m_colorDark,
    fontFamily: 'Cursive',
    clearEdges: 0,
    margin: -1,
    size: .15,
  };
  var optionLogo = options.logo;
  optionLogo && (optionLogo.image || optionLogo.text) && assign(logo, optionLogo);
  // if a logo is to be added, correctLevel is set to H
  if (logo.image || logo.text) {
    options.correctLevel = 'H';
    if (logo.margin < 0) logo.margin = logo.image ? 0 : 2;
  }

  // Generate QRCode data with qrcode-light.js
  var qr = qrcode(options.typeNumber, options.correctLevel);
  qr.addData(options.data);
  qr.make();

  // calculate QRCode and cell sizes
  var count = qr.getModuleCount();
  var cellSize = options.cellSize;
  var size = options.size;
  if (!cellSize && !size) cellSize = 2;
  if (cellSize) {
    size = cellSize * count;
  } else {
    cellSize = size / count;
  }
  _this.m_cellSize = cellSize;
  _this.m_size = size;
  _this.m_count = count;
  _this.m_data = qr;
};
QRCanvas.prototype.m_isDark = function (i, j) {
  var _this = this;
  var count = _this.m_count;
  return i >= 0 && i < count && j >= 0 && j < count
    && _this.m_shouldTransclude(i * count + j)
    && _this.m_data.isDark(i, j);
};
QRCanvas.prototype.m_draw = function () {
  var _this = this;
  var options = _this.m_options;
  // ensure size and cellSize are integers
  // so that there will not be gaps between cells
  var cellSize = Math.ceil(_this.m_cellSize);
  var size = cellSize * _this.m_count;
  var canvasData = getCanvas(size, size);

  _this.m_initLogo(canvasData);
  _this.m_drawCells(canvasData, cellSize);
  _this.m_clearLogo(canvasData);

  var canvasFore = getCanvas(size, size);
  initCanvas(canvasFore, assign({
    cellSize: cellSize,
    size: size,
    data: options.foreground,
  }));
  var contextFore = canvasFore.getContext('2d');
  contextFore.globalCompositeOperation = 'destination-in';
  contextFore.drawImage(canvasData, 0, 0);

  var canvas = getCanvas(size, size);
  initCanvas(canvas, {
    cellSize: cellSize,
    size: size,
    data: options.background,
  });
  var context = canvas.getContext('2d');
  context.drawImage(canvasFore, 0, 0);

  var logo = _this.m_logo;
  if (logo.canvas) context.drawImage(logo.canvas, logo.x, logo.y);
  options.noAlpha && _this.m_transformAlpha(context);

  var destSize = _this.m_size;
  var canvasTarget = options.reuseCanvas;
  if (canvasTarget) {
    canvasTarget.width = canvasTarget.height = destSize;
  } else if (size != destSize) {
    // strech image if the size is not expected
    canvasTarget = getCanvas(destSize, destSize);
  }
  if (canvasTarget) {
    var contextTarget = canvasTarget.getContext('2d');
    contextTarget.drawImage(canvas, 0, 0, destSize, destSize);
  } else {
    canvasTarget = canvas;
  }
  return canvasTarget;
};
QRCanvas.prototype.m_initLogo = function (canvas) {
  // limit the logo size
  var _this = this;
  var logo = _this.m_logo;
  var count = _this.m_count;
  var cellSize = _this.m_cellSize;
  var size = _this.m_size;
  var context = canvas.getContext('2d');
  var k, width, height;

  // if logo is an image
  if (logo.image) {
    k = logo.image;
    width = k.naturalWidth || k.width;
    height = k.naturalHeight || k.height;
  }
  // if logo is text
  else if (logo.text) {
    // get text width/height radio by assuming fontHeight=100px
    height = 100;
    k = '';
    if (logo.fontStyle) k += logo.fontStyle + ' ';
    k += height + 'px ' + logo.fontFamily;
    context.font = k;
    width = context.measureText(logo.text).width;
  }
  // otherwise do nothing
  else return;

  // calculate the number of cells to be broken or covered by the logo
  k = width / height;
  var numberHeight = ~~ (Math.sqrt(Math.min(width * height / size / size, logo.size) / k) * count);
  var numberWidth = ~~ (k * numberHeight);
  // (count - [numberWidth | numberHeight]) must be even if the logo is in the middle
  if ((count - numberWidth) % 2) numberWidth ++;
  if ((count - numberHeight) % 2) numberHeight ++;

  // calculate the final width and height of the logo
  k = Math.min((numberHeight * cellSize - 2 * logo.margin) / height, (numberWidth * cellSize - 2 * logo.margin) / width, 1);
  logo.width = ~~ (k * width);
  logo.height = ~~ (k * height);
  logo.x = ((size - logo.width) >> 1) - logo.margin;
  logo.y = ((size - logo.height) >> 1) - logo.margin;

  // draw logo to a canvas
  logo.canvas = getCanvas(logo.width + 2 * logo.margin, logo.height + 2 * logo.margin);
  var ctx = logo.canvas.getContext('2d');
  if (logo.image) {
    ctx.drawImage(logo.image, logo.margin, logo.margin, logo.width, logo.height);
  } else {
    var font = '';
    if (logo.fontStyle) font += logo.fontStyle + ' ';
    font += logo.height + 'px ' + logo.fontFamily;
    ctx.font = font;
    // draw text in the middle
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = logo.color;
    ctx.fillText(logo.text, (logo.width >> 1) + logo.margin, (logo.height >> 1) + logo.margin);
  }
  _this.m_detectEdges();
};
QRCanvas.prototype.m_drawCells = function (canvas, cellSize) {
  var _this = this;
  var count = _this.m_count;
  var effect = _this.m_options.effect;
  var options = {
    context: canvas.getContext('2d'),
    effect: effect.value * cellSize,
  };
  // draw qrcode according to effect
  var drawCell = QRCanvas.m_effects[effect.key] || _this.m_drawSquare;
  // draw cells
  for (var i = 0; i < count; i ++) {
    for (var j = 0; j < count; j ++) {
      drawCell.call(_this, assign({
        i: i,
        j: j,
        x: j * cellSize,
        y: i * cellSize,
      }, options));
    }
  }
};
QRCanvas.prototype.m_drawSquare = function (cell) {
  var _this = this;
  var context = cell.context;
  var cellSize = _this.m_cellSize;
  if (_this.m_isDark(cell.i, cell.j)) {
    context.fillStyle = QRCanvas.m_colorDark;
    context.fillRect(cell.x, cell.y, cellSize, cellSize);
  }
};
QRCanvas.prototype.m_transformAlpha = function (context) {
  var _this = this;
  var size = _this.m_size;
  var imageData = context.getImageData(0, 0, size, size);
  var total = size * size;
  var transformColor = _this.m_transformColor;
  for (var i = 0; i < total; i ++) {
    var offset = i * 4;
    var alpha = imageData.data[offset + 3];
    if (alpha < 255) {
      imageData.data[offset] = transformColor(imageData.data[offset], 255, alpha);
      imageData.data[offset + 1] = transformColor(imageData.data[offset + 1], 255, alpha);
      imageData.data[offset + 2] = transformColor(imageData.data[offset + 2], 255, alpha);
      imageData.data[offset + 3] = 255;
    }
  }
  context.putImageData(imageData, 0, 0);
};
/**
 * @desc Transform color to remove alpha channel
 */
QRCanvas.prototype.m_transformColor = function (fg, bg, alpha) {
  return ~~ (fg * alpha / 255 + bg * (255 - alpha) / 255);
};
QRCanvas.prototype.m_detectEdges = function () {};
QRCanvas.prototype.m_clearLogo = function (canvas) {};
QRCanvas.prototype.m_shouldTransclude = function (index) {
  var _this = this;
  if (_this.m_logo.clearEdges) {
    return false;
  } else {
    return true;
  }
};

function qrcanvas(options) {
  var qrcanvas = new QRCanvas(options)
  return qrcanvas.m_draw();
}
