import process from 'process';
import fs from 'fs';
import sha1 from 'sha1';
import axios from 'axios';
import crypto from 'crypto';


function encodeBencode(bencode) {
  if (Number.isFinite(bencode)) {
    return `i${bencode}e`;
  } else if (typeof bencode === 'string') {
    const buff = Buffer.from(bencode, 'binary');
    return `${buff.length}:${buff.toString('binary')}`;
  } else if (Array.isArray(bencode)) {
    return `l${bencode.map((item) => encodeBencode(item)).join('')}e`;
  } 
  else {
    return `d${Object.entries(bencode).sort(([keyA], [keyB]) => keyA.localeCompare(keyB))
      .map(([k, v]) => {
        if (k === 'pieces') {
          // Treat 'pieces' as binary data
          const piecesBuff = Buffer.from(v, 'binary');
          const pieces=convertUint8ArrayPiecesToHex(v);
          return `${encodeBencode(k)}${pieces.length*20}:${encodeBencode(pieces)}`;
        }
        else{
          const stringValue = checkAndConvertIsUint8Array(v);
        return `${encodeBencode(k)}${encodeBencode(stringValue)}`;
        }
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
          dict[key] =   new Uint8Array([...piecesData].map(char => char.charCodeAt(0)));
          bencodedValue = bencodedValue.slice(colonIndex + 1 + length);
        } else {
          let [value, rem2] = decode(rem1);
       
          if(isString(value)){
            dict[key] =   new Uint8Array([...value].map(char => char.charCodeAt(0)));
          }
          else{
          dict[key] = value;
          }
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

function isString(value){
    return typeof value === 'string';
}

async function main() {
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
    const hash = calculateSHA1(bencodedInfo);

    console.log('Tracker URL:', convertUint8ArrayToString(decodedValue.announce));
    console.log('Length:', decodedValue.info.length);
    console.log('Info Hash:', hash);
    console.log('Piece Length:', decodedValue.info['piece length']);
    console.log('Piece Hashes:', convertUint8ArrayPiecesToHex(decodedValue.info.pieces));
    
  }
  else if(command === 'peers'){
    const torrentFilePath = process.argv[3];
    const buff = fs.readFileSync(torrentFilePath);




    const bencodedValueAsString = buff.toString('binary');
    const decodedValue = decodeBencode(bencodedValueAsString);
    const bencodedInfo = encodeBencode(decodedValue.info);



    const trackerUrl = convertUint8ArrayToString(decodedValue.announce);
    const infoHash = calculateInfoHash(bencodedInfo);


    const peerId = '01234567890123456789';
    const port = 6881;
    const uploaded = 0;
    const downloaded = 0;
    const left = decodedValue.info.length;
    const compact = 1;

    const queryParams = new URLSearchParams({
      info_hash: encodeURIComponent(infoHash),
      peer_id: peerId,
      port: port,
      uploaded: uploaded,
      downloaded: downloaded,
      left: left,
      compact: compact
  });

const url = `${trackerUrl}?${queryParams}`;
  const res = await fetch(url).then((x) => (x.ok ? x.arrayBuffer() : Promise.reject(x)));
  const bytes = new Uint8Array(res);
  let resData = decodeBencode(bytes, { bytes: true });
  resData=convertUint8ArrayToString(resData)
  if (!resData.peers) {
    console.log("res err ::", );
    console.log("url ::", url);
  } else {
    const peers = [];
    const bs = resData.peers;
    for (let i = 0; i < bs.length; i += 6) {
      const portNumber = (bs[i + 4] << 8) + bs[i + 5];
      peers.push(`${bs[i]}.${bs[i + 1]}.${bs[i + 2]}.${bs[i + 3]}:${portNumber}`);
    }
    console.log(peers.join("\n"));
  }

  
  }
  else {
    throw new Error(`Unknown command ${command}`);
  }
}

main();

function splitBufferToHexArray(buffer, pieceLength) {
  const piecesArray = [];
  for (let i = 0; i < buffer.length; i += pieceLength) {
    const piece = buffer.slice(i, i + pieceLength);
    piecesArray.push(Buffer.from(piece, 'binary').toString('hex'));
  }
  return piecesArray;
}



function convertUint8ArrayToString(uint8Array){
  return Buffer.from(uint8Array).toString('utf-8');
}

function convertUint8ArrayPiecesToHex(uint8Array){
   const pieces=[];
   const hashLength = 20;
   for(let i=0;i<uint8Array.length;i+=hashLength){
    const piece = uint8Array.slice(i,i+hashLength);
    const pieceHex = convertUint8ArrayToHexString(piece);
    pieces.push(pieceHex);
   }
   return pieces;
}


function convertUint8ArrayToHexString(uint8Array){
  return Array.from(uint8Array).map(byte=>byte.toString(16).padStart(2,'0')).join('');
}


function checkAndConvertIsUint8Array(bencode){
  if (bencode instanceof Uint8Array) {
    const stringValue =  convertUint8ArrayToString(bencode);
    return stringValue;
  }
  else {
    return bencode;
  }
}

function calculateInfoHash(bencodedInfo) {
  const hash = crypto.createHash('sha1');
  hash.update(bencodedInfo);
  const infoHash = hash.digest('hex'); 

  return infoHash;
}