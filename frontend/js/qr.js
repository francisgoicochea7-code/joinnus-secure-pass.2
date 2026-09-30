/* =========================================================================
 * JOINNUS SECURE PASS — frontend/js/qr.js
 * -------------------------------------------------------------------------
 * Generador de códigos QR 100% en JavaScript, sin dependencias externas.
 *
 * Implementa el estándar ISO/IEC 18004 en modo BYTE:
 *   - Selección automática de versión (1 a 20)
 *   - Corrección de errores Reed-Solomon (niveles L, M, Q, H)
 *   - Enmascarado con evaluación de penalización (reglas 1 a 4)
 *   - Información de formato y de versión (BCH)
 *
 * NO necesita CDN, por lo que el prototipo funciona sin conexión a internet
 * y la imagen del QR se dibuja en el propio navegador (canvas).
 * ========================================================================= */

(function (global) {
  'use strict';

  /* ---------------------------------------------------------------------
   * 1. Campo de Galois GF(256) — polinomio primitivo 0x11D
   * ------------------------------------------------------------------- */
  var EXP = new Uint8Array(512);
  var LOG = new Uint8Array(256);

  (function initTables() {
    var x = 1;
    for (var i = 0; i < 255; i++) {
      EXP[i] = x;
      LOG[x] = i;
      x <<= 1;
      if (x & 0x100) x ^= 0x11d; // x = x * 2 mod 0x11D
    }
    for (var j = 255; j < 512; j++) EXP[j] = EXP[j - 255];
  })();

  function gfMul(a, b) {
    if (a === 0 || b === 0) return 0;
    return EXP[LOG[a] + LOG[b]];
  }

  /* ---------------------------------------------------------------------
   * 2. Tablas de la especificación
   *    [ECC por bloque, bloques grupo 1, datos g1, bloques grupo 2, datos g2]
   * ------------------------------------------------------------------- */
  var ECC_FORMAT_BITS = { L: 1, M: 0, Q: 3, H: 2 };

  var ECC_TABLE = {
    L: [null,
      [7, 1, 19, 0, 0], [10, 1, 34, 0, 0], [15, 1, 55, 0, 0], [20, 1, 80, 0, 0],
      [26, 1, 108, 0, 0], [18, 2, 68, 0, 0], [20, 2, 78, 0, 0], [24, 2, 97, 0, 0],
      [30, 2, 116, 0, 0], [18, 2, 68, 2, 69], [20, 4, 81, 0, 0], [24, 2, 92, 2, 93],
      [26, 4, 107, 0, 0], [30, 3, 115, 1, 116], [22, 5, 87, 1, 88], [24, 5, 98, 1, 99],
      [28, 1, 107, 5, 108], [30, 5, 120, 1, 121], [28, 3, 113, 4, 114], [28, 3, 107, 5, 108]],
    M: [null,
      [10, 1, 16, 0, 0], [16, 1, 28, 0, 0], [26, 1, 44, 0, 0], [18, 2, 32, 0, 0],
      [24, 2, 43, 0, 0], [16, 4, 27, 0, 0], [18, 4, 31, 0, 0], [22, 2, 38, 2, 39],
      [22, 3, 36, 2, 37], [26, 4, 43, 1, 44], [30, 1, 50, 4, 51], [22, 6, 36, 2, 37],
      [22, 8, 37, 1, 38], [24, 4, 40, 5, 41], [24, 5, 41, 5, 42], [28, 7, 45, 3, 46],
      [28, 10, 46, 1, 47], [26, 9, 43, 4, 44], [26, 3, 44, 11, 45], [26, 3, 41, 13, 42]],
    Q: [null,
      [13, 1, 13, 0, 0], [22, 1, 22, 0, 0], [18, 2, 17, 0, 0], [26, 2, 24, 0, 0],
      [18, 2, 15, 2, 16], [24, 4, 19, 0, 0], [18, 2, 14, 4, 15], [22, 4, 18, 2, 19],
      [20, 4, 16, 4, 17], [24, 6, 19, 2, 20], [28, 4, 22, 4, 23], [26, 4, 20, 6, 21],
      [24, 8, 20, 4, 21], [20, 11, 16, 5, 17], [30, 5, 24, 7, 25], [24, 15, 19, 2, 20],
      [28, 1, 22, 15, 23], [28, 17, 22, 1, 23], [26, 17, 21, 4, 22], [30, 15, 24, 5, 25]],
    H: [null,
      [17, 1, 9, 0, 0], [28, 1, 16, 0, 0], [22, 2, 13, 0, 0], [16, 4, 9, 0, 0],
      [22, 2, 11, 2, 12], [28, 4, 15, 0, 0], [26, 4, 13, 1, 14], [26, 4, 14, 2, 15],
      [24, 4, 12, 4, 13], [28, 6, 15, 2, 16], [24, 3, 12, 8, 13], [28, 7, 14, 4, 15],
      [22, 12, 11, 4, 12], [24, 11, 12, 5, 13], [24, 11, 12, 7, 13], [30, 3, 15, 13, 16],
      [28, 2, 14, 17, 15], [28, 2, 14, 19, 15], [26, 9, 13, 16, 14], [28, 15, 15, 10, 16]]
  };

  var TOTAL_CODEWORDS = [0, 26, 44, 70, 100, 134, 172, 196, 242, 292, 346,
    404, 466, 532, 581, 655, 733, 815, 901, 991, 1085];

  var ALIGN_POS = [null, [], [6, 18], [6, 22], [6, 26], [6, 30], [6, 34],
    [6, 22, 38], [6, 24, 42], [6, 26, 46], [6, 28, 50], [6, 30, 54],
    [6, 32, 58], [6, 34, 62], [6, 26, 46, 66], [6, 26, 48, 70], [6, 26, 50, 74],
    [6, 30, 54, 78], [6, 30, 56, 82], [6, 30, 58, 86], [6, 34, 62, 90]];

  var MAX_VERSION = 20;

  /* ---------------------------------------------------------------------
   * 3. Utilidades de bytes
   * ------------------------------------------------------------------- */
  function toUtf8Bytes(text) {
    if (typeof TextEncoder !== 'undefined') {
      return Array.prototype.slice.call(new TextEncoder().encode(text));
    }
    var out = [];
    for (var i = 0; i < text.length; i++) {
      var c = text.charCodeAt(i);
      if (c < 0x80) out.push(c);
      else if (c < 0x800) {
        out.push(0xc0 | (c >> 6), 0x80 | (c & 0x3f));
      } else {
        out.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 0x3f), 0x80 | (c & 0x3f));
      }
    }
    return out;
  }

  /* ---------------------------------------------------------------------
   * 4. Reed-Solomon
   * ------------------------------------------------------------------- */
  var generatorCache = {};

  function rsGeneratorPoly(degree) {
    if (generatorCache[degree]) return generatorCache[degree];
    var poly = [1];
    for (var i = 0; i < degree; i++) {
      var next = new Array(poly.length + 1);
      for (var j = 0; j < next.length; j++) next[j] = 0;
      for (var j2 = 0; j2 < poly.length; j2++) {
        next[j2] ^= poly[j2];
        next[j2 + 1] ^= gfMul(poly[j2], EXP[i]);
      }
      poly = next;
    }
    generatorCache[degree] = poly;
    return poly;
  }

  function rsRemainder(data, degree) {
    var gen = rsGeneratorPoly(degree);
    var result = new Array(degree);
    for (var i = 0; i < degree; i++) result[i] = 0;
    for (var k = 0; k < data.length; k++) {
      var factor = data[k] ^ result[0];
      result.shift();
      result.push(0);
      for (var j = 0; j < degree; j++) {
        result[j] ^= gfMul(gen[j + 1], factor);
      }
    }
    return result;
  }

  /* ---------------------------------------------------------------------
   * 5. Información de formato y de versión (BCH)
   * ------------------------------------------------------------------- */
  function formatInfoBits(eccLevel, mask) {
    var data = (ECC_FORMAT_BITS[eccLevel] << 3) | mask;
    var rem = data;
    for (var i = 0; i < 10; i++) {
      rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
    }
    return ((data << 10) | rem) ^ 0x5412;
  }

  function versionInfoBits(version) {
    var rem = version;
    for (var i = 0; i < 12; i++) {
      rem = (rem << 1) ^ ((rem >>> 11) * 0x1f25);
    }
    return (version << 12) | rem;
  }

  /* ---------------------------------------------------------------------
   * 6. Construcción de la matriz
   * ------------------------------------------------------------------- */
  function QrMatrix(version, eccLevel, dataBytes) {
    this.version = version;
    this.eccLevel = eccLevel;
    this.size = version * 4 + 17;
    this.modules = new Uint8Array(this.size * this.size);
    this.reserved = new Uint8Array(this.size * this.size);
    this.dataBytes = dataBytes;
  }

  QrMatrix.prototype.idx = function (r, c) { return r * this.size + c; };
  QrMatrix.prototype.get = function (r, c) { return this.modules[r * this.size + c]; };
  QrMatrix.prototype.set = function (r, c, dark, isFunction) {
    this.modules[r * this.size + c] = dark ? 1 : 0;
    if (isFunction) this.reserved[r * this.size + c] = 1;
  };

  QrMatrix.prototype.drawFunctionPatterns = function () {
    var size = this.size, i;

    // Patrones de detección de posición (finder) + separadores
    for (i = 0; i < 3; i++) {
      var fr = i === 2 ? size - 7 : 0;
      var fc = i === 1 ? size - 7 : 0;
      for (var dr = -1; dr <= 7; dr++) {
        for (var dc = -1; dc <= 7; dc++) {
          var rr = fr + dr, cc = fc + dc;
          if (rr < 0 || rr >= size || cc < 0 || cc >= size) continue;
          var inRing = (dr >= 0 && dr <= 6 && (dc === 0 || dc === 6)) ||
                       (dc >= 0 && dc <= 6 && (dr === 0 || dr === 6));
          var inCore = dr >= 2 && dr <= 4 && dc >= 2 && dc <= 4;
          this.set(rr, cc, (inRing || inCore) ? 1 : 0, true);
        }
      }
    }

    // Patrones de alineación
    var pos = ALIGN_POS[this.version];
    for (i = 0; i < pos.length; i++) {
      for (var j = 0; j < pos.length; j++) {
        if ((i === 0 && j === 0) || (i === 0 && j === pos.length - 1) ||
            (i === pos.length - 1 && j === 0)) continue;
        this.drawAlignment(pos[i], pos[j]);
      }
    }

    // Patrones de temporización (solo entre los patrones de detección)
    for (i = 8; i <= size - 9; i++) {
      this.set(6, i, i % 2 === 0, true);
      this.set(i, 6, i % 2 === 0, true);
    }

    // Reserva de zonas de información
    this.drawFormatBits(0);
    if (this.version >= 7) this.drawVersionBits();
  };

  QrMatrix.prototype.drawAlignment = function (r, c) {
    for (var dr = -2; dr <= 2; dr++) {
      for (var dc = -2; dc <= 2; dc++) {
        var dist = Math.max(Math.abs(dr), Math.abs(dc));
        this.set(r + dr, c + dc, dist !== 1, true);
      }
    }
  };

  QrMatrix.prototype.drawFormatBits = function (mask) {
    var size = this.size;
    var bits = formatInfoBits(this.eccLevel, mask);
    function bit(i) { return (bits >>> i) & 1; }

    // Copia 1 (alrededor del finder superior izquierdo)
    for (var i = 0; i <= 5; i++) this.set(i, 8, bit(i), true);
    this.set(7, 8, bit(6), true);
    this.set(8, 8, bit(7), true);
    this.set(8, 7, bit(8), true);
    for (var j = 9; j < 15; j++) this.set(8, 14 - j, bit(j), true);

    // Copia 2 (dividida entre las otras dos esquinas)
    for (var k = 0; k < 8; k++) this.set(8, size - 1 - k, bit(k), true);
    for (var m = 8; m < 15; m++) this.set(size - 15 + m, 8, bit(m), true);

    // Módulo oscuro fijo
    this.set(size - 8, 8, 1, true);
  };

  QrMatrix.prototype.drawVersionBits = function () {
    var size = this.size;
    var bits = versionInfoBits(this.version);
    for (var i = 0; i < 18; i++) {
      var bit = (bits >>> i) & 1;
      var a = size - 11 + (i % 3);
      var b = Math.floor(i / 3);
      this.set(a, b, bit, true);
      this.set(b, a, bit, true);
    }
  };

  /* ---------------------------------------------------------------------
   * 7. Enmascarado
   * ------------------------------------------------------------------- */
  QrMatrix.prototype.maskFunc = function (mask, r, c) {
    switch (mask) {
      case 0: return (r + c) % 2 === 0;
      case 1: return r % 2 === 0;
      case 2: return c % 3 === 0;
      case 3: return (r + c) % 3 === 0;
      case 4: return (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0;
      case 5: return (r * c) % 2 + (r * c) % 3 === 0;
      case 6: return ((r * c) % 2 + (r * c) % 3) % 2 === 0;
      default: return ((r + c) % 2 + (r * c) % 3) % 2 === 0;
    }
  };

  QrMatrix.prototype.applyMask = function (mask) {
    for (var r = 0; r < this.size; r++) {
      for (var c = 0; c < this.size; c++) {
        var i = r * this.size + c;
        if (!this.reserved[i] && this.maskFunc(mask, r, c)) {
          this.modules[i] ^= 1;
        }
      }
    }
  };

  QrMatrix.prototype.getPenaltyScore = function () {
    var size = this.size, N1 = 3, N2 = 3, N3 = 40, N4 = 10, score = 0, r, c, i;

    // Regla 1: series de 5 o más módulos del mismo color
    for (r = 0; r < size; r++) {
      var runColor = this.get(r, 0), runLen = 1;
      for (c = 1; c < size; c++) {
        if (this.get(r, c) === runColor) {
          runLen++;
          if (runLen === 5) score += N1;
          else if (runLen > 5) score++;
        } else { runColor = this.get(r, c); runLen = 1; }
      }
    }
    for (c = 0; c < size; c++) {
      runColor = this.get(0, c); runLen = 1;
      for (r = 1; r < size; r++) {
        if (this.get(r, c) === runColor) {
          runLen++;
          if (runLen === 5) score += N1;
          else if (runLen > 5) score++;
        } else { runColor = this.get(r, c); runLen = 1; }
      }
    }

    // Regla 2: bloques 2x2 del mismo color
    for (r = 0; r < size - 1; r++) {
      for (c = 0; c < size - 1; c++) {
        var v = this.get(r, c);
        if (v === this.get(r, c + 1) && v === this.get(r + 1, c) && v === this.get(r + 1, c + 1)) {
          score += N2;
        }
      }
    }

    // Regla 3: patrón 1:1:3:1:1 con zona clara
    var P1 = [1, 0, 1, 1, 1, 0, 1, 0, 0, 0, 0];
    var P2 = [0, 0, 0, 0, 1, 0, 1, 1, 1, 0, 1];
    function matches(get, idx, pattern) {
      for (var k = 0; k < 11; k++) if (get(idx + k) !== pattern[k]) return false;
      return true;
    }
    for (r = 0; r < size; r++) {
      for (c = 0; c <= size - 11; c++) {
        if (matches(this.get.bind(this, r), c, P1) || matches(this.get.bind(this, r), c, P2)) score += N3;
      }
    }
    for (c = 0; c < size; c++) {
      for (r = 0; r <= size - 11; r++) {
        var colSeq = [];
        for (var k2 = 0; k2 < 11; k2++) colSeq.push(this.get(r + k2, c));
        var ok1 = true, ok2 = true;
        for (var m = 0; m < 11; m++) {
          if (colSeq[m] !== P1[m]) ok1 = false;
          if (colSeq[m] !== P2[m]) ok2 = false;
        }
        if (ok1 || ok2) score += N3;
      }
    }

    // Regla 4: desequilibrio entre módulos claros y oscuros
    var dark = 0;
    for (i = 0; i < this.modules.length; i++) dark += this.modules[i];
    var total = size * size;
    var percent = (dark * 100) / total;
    var k = Math.floor(Math.abs(percent - 50) / 5);
    score += k * N4;

    return score;
  };

  /* ---------------------------------------------------------------------
   * 8. Codificación del contenido
   * ------------------------------------------------------------------- */
  function dataCapacityBytes(version, eccLevel) {
    var row = ECC_TABLE[eccLevel][version];
    var dataCodewords = row[1] * row[2] + row[3] * row[4];
    var countBits = version < 10 ? 8 : 16;
    return Math.floor((dataCodewords * 8 - 4 - countBits) / 8);
  }

  function chooseVersion(byteLength, eccLevel) {
    for (var v = 1; v <= MAX_VERSION; v++) {
      if (dataCapacityBytes(v, eccLevel) >= byteLength) return v;
    }
    throw new Error('El contenido es demasiado largo para un código QR (máx. versión ' + MAX_VERSION + ').');
  }

  function buildDataCodewords(bytes, version, eccLevel) {
    var row = ECC_TABLE[eccLevel][version];
    var eccPerBlock = row[0];
    var totalDataCodewords = row[1] * row[2] + row[3] * row[4];
    var countBits = version < 10 ? 8 : 16;

    // 1) Flujo de bits
    var bits = [];
    function push(val, len) {
      for (var i = len - 1; i >= 0; i--) bits.push((val >>> i) & 1);
    }
    push(4, 4);
    push(bytes.length, countBits);
    for (var i = 0; i < bytes.length; i++) push(bytes[i], 8);

    // Terminador + relleno
    var capacity = totalDataCodewords * 8;
    push(0, Math.min(4, capacity - bits.length));
    push(0, (8 - (bits.length % 8)) % 8);

    var codewords = [];
    for (var b = 0; b < bits.length; b += 8) {
      var v = 0;
      for (var k = 0; k < 8; k++) v = (v << 1) | bits[b + k];
      codewords.push(v);
    }
    var padBytes = [0xec, 0x11];
    var padIndex = 0;
    while (codewords.length < totalDataCodewords) {
      codewords.push(padBytes[padIndex % 2]);
      padIndex++;
    }

    // 2) División en bloques + Reed-Solomon
    var dataBlocks = [];
    var eccBlocks = [];
    var offset = 0;
    var blocksG1 = row[1], sizeG1 = row[2], blocksG2 = row[3], sizeG2 = row[4];
    for (var b2 = 0; b2 < blocksG1 + blocksG2; b2++) {
      var size = b2 < blocksG1 ? sizeG1 : sizeG2;
      var dat = codewords.slice(offset, offset + size);
      offset += size;
      dataBlocks.push(dat);
      eccBlocks.push(rsRemainder(dat, eccPerBlock));
    }

    // 3) Intercalado
    var result = [];
    var maxData = Math.max(sizeG1, sizeG2);
    for (var d = 0; d < maxData; d++) {
      for (var blk = 0; blk < dataBlocks.length; blk++) {
        if (d < dataBlocks[blk].length) result.push(dataBlocks[blk][d]);
      }
    }
    for (var e = 0; e < eccPerBlock; e++) {
      for (var blk2 = 0; blk2 < eccBlocks.length; blk2++) {
        result.push(eccBlocks[blk2][e]);
      }
    }

    if (result.length !== TOTAL_CODEWORDS[version]) {
      throw new Error('Inconsistencia en la generación del código QR.');
    }
    return result;
  }

  /* ---------------------------------------------------------------------
   * 9. API pública
   * ------------------------------------------------------------------- */
  function create(text, options) {
    options = options || {};
    var eccLevel = options.eccLevel || 'M';
    if (!ECC_TABLE[eccLevel]) eccLevel = 'M';

    var bytes = toUtf8Bytes(String(text));
    var version = chooseVersion(bytes.length, eccLevel);
    var dataCodewords = buildDataCodewords(bytes, version, eccLevel);

    var qr = new QrMatrix(version, eccLevel, bytes);
    qr.drawFunctionPatterns();

    // Colocación de los datos en zigzag
    var size = qr.size, idx = 0, totalBits = dataCodewords.length * 8;
    for (var right = size - 1; right >= 1; right -= 2) {
      if (right === 6) right = 5;
      for (var vert = 0; vert < size; vert++) {
        for (var j = 0; j < 2; j++) {
          var x = right - j;
          var upward = ((right + 1) & 2) === 0;
          var y = upward ? size - 1 - vert : vert;
          var i = y * size + x;
          if (!qr.reserved[i] && idx < totalBits) {
            qr.modules[i] = ((dataCodewords[idx >>> 3] >>> (7 - (idx & 7))) & 1);
            idx++;
          }
        }
      }
    }

    // Elección de la máscara de menor penalización
    var bestMask = 0, bestScore = Infinity;
    for (var mask = 0; mask < 8; mask++) {
      qr.applyMask(mask);
      qr.drawFormatBits(mask);
      var score = qr.getPenaltyScore();
      if (score < bestScore) { bestScore = score; bestMask = mask; }
      qr.applyMask(mask);
    }
    qr.applyMask(bestMask);
    qr.drawFormatBits(bestMask);
    qr.maskUsed = bestMask;

    return qr;
  }

  /**
   * Dibuja el QR en un canvas.
   * @param {string} text
   * @param {HTMLCanvasElement|string} target
   * @param {object} [opts] { scale, eccLevel, dark, light, quiet }
   */
  function render(text, target, opts) {
    opts = opts || {};
    var qr = create(text, opts);
    var scale = opts.scale || 6;
    var quiet = opts.quiet == null ? 4 : opts.quiet;
    var dimension = (qr.size + quiet * 2) * scale;

    var canvas;
    if (typeof target === 'string') canvas = document.querySelector(target);
    else canvas = target;

    if (!canvas) return null;
    if (!(canvas instanceof HTMLCanvasElement)) {
      canvas = document.createElement('canvas');
    }

    var dpr = opts.dpr || (global.devicePixelRatio || 1);
    canvas.width = dimension * dpr;
    canvas.height = dimension * dpr;
    canvas.style.width = dimension + 'px';
    canvas.style.height = dimension + 'px';

    var ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = opts.light || '#ffffff';
    ctx.fillRect(0, 0, dimension, dimension);
    ctx.fillStyle = opts.dark || '#0b1020';
    for (var r = 0; r < qr.size; r++) {
      for (var c = 0; c < qr.size; c++) {
        if (qr.get(r, c)) {
          ctx.fillRect((c + quiet) * scale, (r + quiet) * scale, scale, scale);
        }
      }
    }
    canvas.setAttribute('aria-label', 'Código QR: ' + text);
    return canvas;
  }

  function toDataURL(text, opts) {
    var tmp = document.createElement('canvas');
    render(text, tmp, opts);
    return tmp.toDataURL('image/png');
  }

  global.QRCode = {
    create: create,
    render: render,
    toDataURL: toDataURL,
    version: '1.0.0',
    standards: 'ISO/IEC 18004 (modo BYTE, versiones 1-20, niveles L/M/Q/H)'
  };

})(typeof window !== 'undefined' ? window : this);
