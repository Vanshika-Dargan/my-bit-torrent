const process = require("process");
const fs = require('fs');



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
            const [decodedValue, rem] = decodeString(bencodedValue);
            return [decodedValue, rem];
        } else if (bencodedValue[0] === 'i') {
            const [decodedValue, rem] = decodeInteger(bencodedValue);
            return [decodedValue, rem];
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
                    bencodedValue = bencodedValue.slice(colonIndex + length + 1);

                } else {
                    let [value, rem2] = decode(rem1);
                    dict[key] = value;
                    bencodedValue = rem2;
                }
            }

            return [dict, bencodedValue.slice(1)];
        }
    }

    const decodedValue = decode(bencodedValue)[0];
    return decodedValue;
}

function encodeBencode(bencode){

    if(Number.isFinite(bencode)){
      return `i${bencode}e`;
    }
  
    else if(typeof bencode === 'string'){
      const buff = Buffer.from(bencode, 'binary');
      return `${buff.length}:`+buff.toString('binary')
    }
  
    else if(Array.isArray(bencode)){
      return `l${bencode.map((item)=>encodeBencode(item)).join("")}e`;
    }
    else{
    return `d${Object.entries(bencode).sort(([keyA],[keyB])=>keyA.localeCompare(keyB)).map(([k,v])=>`${encodeBencode(k)}${encodeBencode(v)}}`).join("")}e`
    }
  }

function main() {
    const command = process.argv[2];

    if (command === "decode") {
        const bencodedValue = process.argv[3];
        console.log(JSON.stringify(decodeBencode(bencodedValue)));
    } else if (command === "info") {
        const torrentFilePath = process.argv[3];


        fs.readFile(torrentFilePath, (err, data) => {
            if (err) {
                console.error('Error reading the torrent file:', err);
                return;
            }
            const bencodedValueAsString = data.toString('binary');

            try {
                const decodedValue = decodeBencode(bencodedValueAsString);
                console.log('Tracker URL:', decodedValue.announce);
                console.log('Length:', decodedValue.info.length);

            } catch (decodeErr) {
                console.error('Error decoding bencoded data:', decodeErr);
            }
        });
    } else {
        throw new Error(`Unknown command ${command}`);
    }
}

main();
