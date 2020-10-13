# hyperledger-fabric-lottery-chaincode
Lottery chaincode in Hyperledger Fabric - educational example. The chance of winning the lottery depends on the amount of the deposit. The lottery draws the winner when the required number of participants is obtained (this number is defined by the creator of each lottery).

To use this chaincode:
1) Firstly run Hyperledger Fabric test network (now it is release 2.2): https://hyperledger-fabric.readthedocs.io/en/release-2.2/test_network.html
2) Run `npm install` to install `fabric-contract-api`, `fabric-shim` and `seedrandom` dependecies
3) Deploy a chaincode to a channel: https://hyperledger-fabric.readthedocs.io/en/release-2.2/deploy_chaincode.html#install-the-chaincode-package
4) Invoke function `InitLedger()` (instruction is also in the link above)
5) Now you can invoke the rest of the functions 
