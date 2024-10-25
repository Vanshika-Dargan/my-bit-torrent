const process = require("process");
const fs = require('fs');
const sha1 = require('sha1');

function encodeBencode(bencode) {
  if (Number.isFinite(bencode)) {
    return `i${bencode}e`;
  } else if (typeof bencode === 'string') {
    const buff = Buffer.from(bencode, 'binary');
    return `${buff.length}:${buff.toString('binary')}`;
  } else if (Array.isArray(bencode)) {
    return `l${bencode.map((item) => encodeBencode(item)).join('')}e`;
  } else {
    return `d${Object.entries(bencode).sort(([keyA], [keyB]) => keyA.localeCompare(keyB))
      .map(([k, v]) => {
        if (k === 'pieces') {
          // Treat 'pieces' as binary data
          const piecesBuff = Buffer.from(v, 'binary');
          return `${k.length}:${k}${piecesBuff.length}:${piecesBuff.toString('binary')}`;
        }
        return `${encodeBencode(k)}${encodeBencode(v)}`;
      }).join('')}e`;
  }
}

function decodeBencode(bencodedValue) {
  function decodeString(bencodedValue) {
    const colonIndex = bencodedValue.indexOf(":");
    const length = parseInt(bencodedValue.slice(0, colonIndex), 10);
    return [bencodedValue.slice(colonIndex + 1, colonIndex + 1 + length), bencodedValue.slice(colonIndex + 1 + length)];
  }

  function decodeInteger(bencodedValue) {
    const eIndex = bencodedValue.indexOf('e');
    return [parseInt(bencodedValue.slice(1, eIndex), 10), bencodedValue.slice(eIndex + 1)];
  }

  function decode(bencodedValue) {
    if (/^\d/.test(bencodedValue[0])) {
      return decodeString(bencodedValue);
    } else if (bencodedValue[0] === 'i') {
      return decodeInteger(bencodedValue);
    } else if (bencodedValue[0] === 'l') {
      bencodedValue = bencodedValue.slice(1);
      const output = [];
      while (!bencodedValue.startsWith('e')) {
        const [decodedValue, rem] = decode(bencodedValue);
        output.push(decodedValue);
        bencodedValue = rem;
      }
      return [output, bencodedValue.slice(1)];
    } else if (bencodedValue[0] === 'd') {
      bencodedValue = bencodedValue.slice(1);
      const dict = {};
      while (!bencodedValue.startsWith('e')) {
        let [key, rem1] = decode(bencodedValue);
        bencodedValue = rem1;
        if (key === 'pieces') {
          const colonIndex = bencodedValue.indexOf(":");
          const length = parseInt(bencodedValue.slice(0, colonIndex), 10);
          const piecesData = bencodedValue.slice(colonIndex + 1, colonIndex + 1 + length);
          dict[key] = Buffer.from(piecesData, 'binary'); // Store as binary buffer
          bencodedValue = bencodedValue.slice(colonIndex + 1 + length);
        } else {
          let [value, rem2] = decode(rem1);
          dict[key] = value;
          bencodedValue = rem2;
        }
      }
      return [dict, bencodedValue.slice(1)];
    }
  }

  return decode(bencodedValue)[0];
}

function calculateSHA1(buffer) {
  return sha1(buffer);
}

function main() {
  const command = process.argv[2];

  if (command === "decode") {
    const bencodedValue = process.argv[3];
    console.log(JSON.stringify(decodeBencode(bencodedValue)));
  } else if (command === "info") {
    const torrentFilePath = process.argv[3];

    const buff = fs.readFileSync(torrentFilePath);
    const bencodedValueAsString = buff.toString('binary');
    const decodedValue = decodeBencode(bencodedValueAsString);
    const bencodedInfo = encodeBencode(decodedValue.info);
    const newBuff = Buffer.from(bencodedInfo, 'binary');
    const hash = calculateSHA1(newBuff);

    console.log('Tracker URL:', decodedValue.announce);
    console.log('Length:', decodedValue.info.length);
    console.log('Info Hash:', hash);
  } else {
    throw new Error(`Unknown command ${command}`);
  }
}

main();
