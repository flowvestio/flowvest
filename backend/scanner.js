const { ethers } = require("ethers");
const db = require("./db");
const C = require("./config");

const provider = new ethers.providers.JsonRpcProvider(C.RPC);

const FLOW_ABI = [
  "function vestCount() view returns (uint256)",
  "function vests(uint256 id) view returns (address owner,address beneficiary,uint256 startAt,uint256 monthlyAmount,uint256 principal,uint256 releasedAmount,bool terminated)"
];

const flow = new ethers.Contract(C.FLOW, FLOW_ABI, provider);

async function scan(){
  try{
    const countBN = await flow.vestCount();
    const count = countBN.toNumber();
    if (!count) return;

    const start = Math.max(1, count - 200);

    for (let id = count; id >= start; id--){
      const v = await flow.vests(id);

      await db.query(
        `REPLACE INTO vests 
        (vest_id, owner, beneficiary, start_at, monthly, principal, released, terminated)
        VALUES (?,?,?,?,?,?,?,?)`,
        [
          id,
          v.owner,
          v.beneficiary,
          v.startAt.toString(),
          ethers.utils.formatUnits(v.monthlyAmount,6),
          ethers.utils.formatUnits(v.principal,6),
          ethers.utils.formatUnits(v.releasedAmount,6),
          v.terminated ? 1 : 0
        ]
      );
    }

    console.log("Scan complete:", new Date().toISOString());
  }catch(e){
    console.error("Scan error:", e.message);
  }
}

setInterval(scan, 60000);
scan();
