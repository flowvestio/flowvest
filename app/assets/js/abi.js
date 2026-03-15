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
      "function vests(uint256) view returns (address owner,address beneficiary,uint256 startAt,uint256 monthly,uint256 principal,uint256 released,bool terminated)",
      "function dueAmount(uint256) view returns (uint256)",
      "function createVest(address beneficiary,uint256 startAt,uint256 monthly)",
      "event VestCreated(uint256 indexed vestId, address indexed owner, address indexed beneficiary)",
      "function release(uint256 vestId)",
      "function terminate(uint256 vestId)"
    ]

  };

})();
