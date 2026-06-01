// assets/app/abi.js
(function(){

  window.ABI = {

    ERC20: [
      "function balanceOf(address) view returns (uint256)",
      "function approve(address spender,uint256 amount) returns (bool)",
      "function allowance(address owner,address spender) view returns (uint256)",
      "function decimals() view returns (uint8)"
    ],

    FLOW: [
      "function vestCount() view returns (uint256)",
      "function totalPrincipal() view returns (uint256)",
      "function tvlCap() view returns (uint256)",
      "function maxPrincipal() view returns (uint256)",
      "function vests(uint256) view returns (address owner,address beneficiary,uint256 startAt,uint256 periodAmount,uint256 principal,uint256 releasedAmount,bool terminated,uint8 plan)",
      "function dueAmount(uint256) view returns (uint256)",
      "function createVest(address beneficiary,uint256 startAt,uint256 periodAmount,uint8 plan)",
      "event VestCreated(uint256 indexed id,address indexed owner_,address indexed beneficiary,uint256 startAt,uint256 periodAmount,uint256 principal,uint8 plan)",
      "function release(uint256 vestId)",
      "function batchRelease(uint256[] ids) returns (uint256 processedCount,uint256 totalAmount)",
      "function terminate(uint256 vestId)"
    ]

  };

})();
