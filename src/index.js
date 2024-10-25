const process = require('process');


function decodeBencode(bencodedValue){

    function decodeString(bencodedValue){
    const colonIndex = bencodedValue.indexOf(":");
    const length = parseInt(bencodedValue.slice(0, colonIndex),10);
    return [bencodedValue.slice(colonIndex+1, colonIndex+1+length), bencodedValue.slice(colonIndex+1+length)];
    }

    function decodeInteger(bencodedValue){
    const eIndex = bencodedValue.indexOf('e');
    return [parseInt(bencodedValue.slice(1,eIndex),10),bencodedValue.slice(eIndex+1)];
    }

    function decode(bencodedValue){
    
        if(/^\d/.test(bencodedValue[0])){
            const [decodedValue,rem]=decodeString(bencodedValue);
            return [decodedValue,rem];
        }
        else if(bencodedValue[0]==='i'){
            const [decodedValue,rem]=decodeInteger(bencodedValue);
            return [decodedValue,rem];
        }
        else if(bencodedValue[0]==='l'){
            bencodedValue = bencodedValue.slice(1);
            const output = [];
            while(!bencodedValue.startsWith('e')){
                const [decodedValue,rem]=decode(bencodedValue);
                output.push(decodedValue);
                bencodedValue = rem;
            }
            return [output,bencodedValue.slice(1)];
        }
        else if(bencodedValue[0] === 'd'){
            bencodedValue = bencodedValue.slice(1);
            const dict = {}
            while(!bencodedValue.startsWith('e')){
            let [key,rem1] = decode(bencodedValue);
            let [value, rem2] = decode(rem1);
            dict[key] = value;
            bencodedValue = rem2;
            }
            return [dict, bencodedValue.slice(1)];
          }
        else {
            throw new Error("Unsupported or invalid bencoded value");
        }

    }

    const decodedValue = decode(bencodedValue)[0];
    return decodedValue;
}





function main(){
const command= process.argv[2];

if(command === 'decode'){
const bencodedValue = process.argv[3];
console.log(JSON.stringify(decodeBencode(bencodedValue)));
}
else{
    throw new Error(`Unknown command ${command}`)
}

}

main();