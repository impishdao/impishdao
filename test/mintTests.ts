/* eslint-disable node/no-missing-import */
import { BigNumber } from "@ethersproject/bignumber";
import { expect } from "chai";
import { ethers, network, waffle } from "hardhat";
import type { RandomWalkNFT } from "../typechain/RandomWalkNFT";
import type { ImpishDAO } from "../typechain/ImpishDAO";

type FixtureType = {
  impdao: ImpishDAO;
  rwnft: RandomWalkNFT;
};

describe("ImpishDAO Mint Tests", function () {
  async function loadContracts(): Promise<FixtureType> {
    const ImpishDAO = await ethers.getContractFactory("ImpishDAO");
    const RandomWalkNFT = await ethers.getContractFactory("RandomWalkNFT");

    const rwnft = await RandomWalkNFT.deploy();
    await rwnft.deployed();

    const impdao = await ImpishDAO.deploy(rwnft.address);
    await impdao.deployed();

    return { impdao, rwnft };
  }

  it("Should mint tokens", async function () {
    const { impdao, rwnft } = await loadContracts();

    const provider = waffle.provider;
    const [wallet] = provider.getWallets();
    const [signer] = await ethers.getSigners();

    expect(await impdao.balanceOf(wallet.address)).to.equal(0);

    const MINT_RATIO = await impdao.MINT_RATIO();
    const mintAmt = await rwnft.getMintPrice();

    // wait until the transaction is mined
    await (await impdao.deposit({ value: mintAmt })).wait();

    expect(
      await impdao.balanceOf(wallet.address),
      "Wrong token amount"
    ).to.equal(MINT_RATIO.mul(mintAmt));

    // Contract balance should increase by 0, since all the deposited Amount
    // has gone to buy the NFT
    expect(
      await provider.getBalance(impdao.address),
      "Wrong contract balance"
    ).to.equal(0);

    const HUNDRED_ETH = ethers.utils.parseEther("100");
    expect(await impdao.getMaxEthThatCanBeDeposit()).to.eq(HUNDRED_ETH);

    // Deposit just enough to hit the limit
    await impdao.deposit({ value: HUNDRED_ETH });

    expect(await impdao.getMaxEthThatCanBeDeposit(), "wrong full").to.eq(
      BigNumber.from(0)
    );

    // Depositing any more should error try to deposit too much
    await expect(impdao.deposit({ value: 1 })).to.be.revertedWith(
      "Too much ETH"
    );

    // But simply transfering money to the contract should be OK.
    const ONE_ETH = ethers.utils.parseEther("1");
    await expect(
      await signer.sendTransaction({
        to: impdao.address,
        value: ONE_ETH,
      })
    ).to.changeEtherBalance(impdao, ONE_ETH);
  });

  it("Should not mint tokens when paused", async function () {
    const { impdao, rwnft } = await loadContracts();

    const provider = waffle.provider;
    const [wallet] = provider.getWallets();
    const [, otherSigner] = await ethers.getSigners();

    expect(await impdao.owner()).to.equal(wallet.address);

    const mintAmt = ethers.utils.parseEther("0.002");

    const mintPrice = await rwnft.getMintPrice();
    await impdao.deposit({ value: mintAmt });

    // Only the owner can call pause
    await expect(impdao.connect(otherSigner).pause()).to.be.revertedWith(
      "Ownable: caller is not the owner"
    );

    // Owner pauses the contract
    await impdao.pause();

    // Can't mint while paused
    await expect(impdao.deposit({ value: 1000 })).to.be.revertedWith("Paused");

    // But can redeem
    await expect(
      await impdao.redeem(),
      "Didn't get all ETH back!"
    ).to.changeEtherBalance(wallet, mintAmt.sub(mintPrice));
  });

  it("Should mint and redeem tokens (single address) - DAO loses", async function () {
    const { impdao, rwnft } = await loadContracts();

    const provider = waffle.provider;
    const [wallet] = provider.getWallets();

    const MINT_RATIO = await impdao.MINT_RATIO();
    const mintAmt = ethers.utils.parseEther("0.002");

    const mintPrice = await rwnft.getMintPrice();
    const nftID = await rwnft.nextTokenId();
    await impdao.deposit({ value: mintAmt });

    // Assert balances.
    expect(
      await impdao.balanceOf(wallet.address),
      "Incorrect Token balance"
    ).to.equal(MINT_RATIO.mul(mintAmt));

    // Contract should also have the NFT for sale
    expect((await impdao.forSale(nftID)).startPrice).to.equal(
      mintPrice.mul(MINT_RATIO).mul(1000).div(100)
    );

    // This is amount - sent to contract to mint the NFT
    const contractBalance = mintAmt.sub(mintPrice);
    expect(
      await provider.getBalance(impdao.address),
      "Incorrect contract balance"
    ).to.equal(contractBalance);

    // Get outbid
    await rwnft.mint({ value: rwnft.getMintPrice() });

    // Now, fast forward a month, which means we didn't win.
    await network.provider.send("evm_increaseTime", [3600 * 24 * 31]); // 1 month + 1 day
    await network.provider.send("evm_mine");

    // External withdraws
    await rwnft.withdraw();

    // Now finish the contract by calling deposit(), but this should not mint tokens
    await impdao.deposit({ value: 0 });

    // DAO should set the state to "lost"
    expect(await impdao.contractState()).equals(3);

    // Can't deposit any more
    await expect(impdao.deposit({ value: 1000 })).to.be.revertedWith(
      "NotPlaying"
    );

    // Redeem
    await expect(
      await impdao.redeem(),
      "Didn't get all ETH back!"
    ).to.changeEtherBalance(wallet, contractBalance);

    // Assert state after redeeming tokens
    expect(await impdao.balanceOf(wallet.address)).to.equal(0);
    expect(await provider.getBalance(impdao.address)).to.equal(0);
  });

  it("Should mint and redeem tokens (multiple address) - DAO loses", async function () {
    const { impdao, rwnft } = await loadContracts();
    const provider = waffle.provider;

    const MINT_RATIO = await impdao.MINT_RATIO();
    const mintAmt = ethers.utils.parseEther("0.001");

    const signers = (await ethers.getSigners()).slice(0, 5);

    // Mint from all the different addresses. Note that the first deposit()
    // will send `mintPrice` to the NFT contract
    const mintPrice = await rwnft.getMintPrice();
    for (const signer of signers) {
      await impdao.connect(signer).deposit({ value: mintAmt });
      expect(
        await impdao.balanceOf(signer.address),
        "Incorrect Tokens"
      ).to.equal(MINT_RATIO.mul(mintAmt));
    }

    // Assert balances
    expect(
      await provider.getBalance(impdao.address),
      "Incorrect contract balance"
    ).to.equal(mintAmt.mul(signers.length).sub(mintPrice));

    // Get outbid
    await rwnft.mint({ value: rwnft.getMintPrice() });

    // Now, fast forward a month, which means we didn't win.
    await network.provider.send("evm_increaseTime", [3600 * 24 * 31]); // 1 month + 1 day
    await network.provider.send("evm_mine");

    // External withdraws
    await rwnft.withdraw();

    // Now finish the contract by calling deposit(), but this should not mint tokens
    await impdao.deposit({ value: 0 });

    // DAO should set the state to "lost"
    expect(await impdao.contractState()).equals(3);

    // We're expecting each address to get this ether back at redeem()
    const expectedETHToBeReturned = mintAmt.sub(mintPrice.div(signers.length));

    // Redeem
    for (const signer of signers) {
      await expect(
        await impdao.connect(signer).redeem(),
        "Didn't get all ETH back!"
      ).to.changeEtherBalance(signer, expectedETHToBeReturned);
      expect(await impdao.balanceOf(signer.address)).to.equal(0);
    }

    // Assert state after redeeming tokens
    expect(await provider.getBalance(impdao.address)).to.equal(0);
  });

  it("Should mint and redeem tokens (multiple address, different amounts) - DAO wins", async function () {
    const { impdao, rwnft } = await loadContracts();
    const provider = waffle.provider;

    const MINT_RATIO = await impdao.MINT_RATIO();
    let mintAmt = ethers.utils.parseEther("0.0001");

    // First, have an external address mint an NFT
    const extETHdeposited = rwnft.getMintPrice();
    await rwnft.mint({ value: extETHdeposited });

    const signers = (await ethers.getSigners()).slice(0, 5);

    // Mint from all the different addresses. Note that the first deposit()
    // will send `mintPrice` to the NFT contract
    const mintPrice = await rwnft.getMintPrice();

    let totalDeposited = BigNumber.from(0);
    for (const signer of signers) {
      totalDeposited = totalDeposited.add(mintAmt);
      await impdao.connect(signer).deposit({ value: mintAmt });
      expect(
        await impdao.balanceOf(signer.address),
        "Incorrect Tokens"
      ).to.equal(MINT_RATIO.mul(mintAmt));

      // Double the amount deposited each time
      mintAmt = mintAmt.mul(2);
    }

    // Assert balances
    expect(
      await provider.getBalance(impdao.address),
      "Incorrect contract balance"
    ).to.equal(totalDeposited.sub(mintPrice));

    // Now, fast forward a month, which means we didn't win.
    await network.provider.send("evm_increaseTime", [3600 * 24 * 31]); // 1 month + 1 day
    await network.provider.send("evm_mine");

    const winAmount = await rwnft.withdrawalAmount();
    const daoBalanace = await provider.getBalance(impdao.address);

    // Now finish the contract by calling deposit(), but this should not mint tokens
    // and make the DAO win
    await impdao.deposit({ value: 0 });

    // DAO should set the state to "won"
    expect(await impdao.contractState()).equals(2);

    // We're expecting to get this ether back at redeem() across all addresses
    const totalETHToBeReturned = daoBalanace.add(winAmount);

    // Calculate how much each address should get back in ETH. This will not be exactly
    // what the address gets because of rounding errors, since the contract calculates
    // this incrementally as people redeem
    const expectedETHToBeReturned = await Promise.all(
      signers.map(async (signer) => {
        const tokenBal = await impdao.balanceOf(signer.address);
        return totalETHToBeReturned
          .mul(tokenBal)
          .div(await impdao.totalSupply());
      })
    );

    // Redeem
    for (let i = 0; i < signers.length; i++) {
      const signer = signers[i];

      // This is how the contract will calculate the ETH to be returned
      const tokenBal = await impdao.balanceOf(signer.address);
      const expected = (await provider.getBalance(impdao.address))
        .mul(tokenBal)
        .div(await impdao.totalSupply());

      // Make sure the contract's calculation method is within rounding limits
      // of the overall calculation.
      expect(expectedETHToBeReturned[i]).to.be.closeTo(expected, 1);

      await expect(
        await impdao.connect(signer).redeem(),
        "Didn't get all ETH back!"
      ).to.changeEtherBalance(signer, expected);
      expect(await impdao.balanceOf(signer.address)).to.equal(0);
    }

    // Assert state after redeeming tokens
    expect(await provider.getBalance(impdao.address)).to.equal(0);
  });

  it("Should mint and redeem tokens (multiple address transfer token) - DAO wins", async function () {
    const { impdao, rwnft } = await loadContracts();
    const provider = waffle.provider;

    const MINT_RATIO = await impdao.MINT_RATIO();
    let mintAmt = ethers.utils.parseEther("0.0001");

    // First, have an external address mint an NFT
    const extETHdeposited = rwnft.getMintPrice();
    await rwnft.mint({ value: extETHdeposited });

    const wallets = provider.getWallets().slice(0, 5);
    const signers = (await ethers.getSigners()).slice(0, 5);

    // Mint from all the different addresses. Note that the first deposit()
    // will send `mintPrice` to the NFT contract
    const mintPrice = await rwnft.getMintPrice();

    let totalDeposited = BigNumber.from(0);
    for (const signer of signers) {
      totalDeposited = totalDeposited.add(mintAmt);
      await impdao.connect(signer).deposit({ value: mintAmt });
      expect(
        await impdao.balanceOf(signer.address),
        "Incorrect Tokens"
      ).to.equal(MINT_RATIO.mul(mintAmt));

      // Double the amount deposited each time
      mintAmt = mintAmt.mul(2);
    }

    // Send all the tokens to the first address
    for (let i = 1; i < signers.length; i++) {
      const signer = signers[i];
      const bal = await impdao.balanceOf(signer.address);

      await expect(() =>
        impdao.connect(signer).transfer(signers[0].address, bal)
      ).to.changeTokenBalances(
        impdao,
        [wallets[0], wallets[i]],
        [bal, bal.mul(-1)]
      );
    }

    // Assert balances
    expect(
      await provider.getBalance(impdao.address),
      "Incorrect contract balance"
    ).to.equal(totalDeposited.sub(mintPrice));

    // Now, fast forward a month, which means we didn't win.
    await network.provider.send("evm_increaseTime", [3600 * 24 * 31]); // 1 month + 1 day
    await network.provider.send("evm_mine");

    const winAmount = await rwnft.withdrawalAmount();
    const daoBalanace = await provider.getBalance(impdao.address);

    // Now finish the contract by calling deposit(), but this should not mint tokens
    // and make the DAO win
    await impdao.deposit({ value: 0 });

    // DAO should set the state to "won"
    expect(await impdao.contractState()).equals(2);

    // We're expecting each address to get this ether back at redeem()
    const totalETHToBeReturned = daoBalanace.add(winAmount);

    await expect(
      await impdao.redeem(),
      "Didn't get all ETH back!"
    ).to.changeEtherBalance(wallets[0], totalETHToBeReturned);

    // Assert state after redeeming tokens
    expect(await impdao.balanceOf(wallets[0].address)).to.equal(0);
    expect(await provider.getBalance(impdao.address)).to.equal(0);
  });

  // NFT tests
  it("Should be able to buy NFT", async function () {
    const { impdao, rwnft } = await loadContracts();

    const provider = waffle.provider;
    const [wallet] = provider.getWallets();

    const mintPrice = await rwnft.getMintPrice();
    const nftID = await rwnft.nextTokenId();

    await impdao.deposit({ value: mintPrice });

    const MINT_RATIO = await impdao.MINT_RATIO();

    // Contract should also have the NFT for sale
    expect((await impdao.forSale(nftID)).startPrice).to.equal(
      mintPrice.mul(MINT_RATIO).mul(1000).div(100)
    );

    // NFT owner is the DAO to start with
    expect(await rwnft.ownerOf(nftID)).to.equal(impdao.address);

    // We don't have enough tokens to buy the NFT right now
    expect(await impdao.balanceOf(wallet.address)).to.lt(
      await impdao.buyNFTPrice(nftID)
    );
    await expect(impdao.buyNFT(nftID)).to.be.revertedWith("Not enough IMPISH");

    // Get more tokens
    await impdao.deposit({ value: mintPrice.mul(10) });

    // Now, buy the NFT
    const buyNFTPrice = await impdao.buyNFTPrice(nftID);
    const tokenBalStart = await impdao.balanceOf(wallet.address);
    await impdao.buyNFT(nftID);
    const tokenBalEnd = await impdao.balanceOf(wallet.address);
    expect(tokenBalStart.sub(tokenBalEnd), "Wrong token Balance").to.lte(
      buyNFTPrice
    );

    // New owner is wallet
    expect(await rwnft.ownerOf(nftID)).to.equal(wallet.address);

    // Can't buy the same token again.
    await expect(impdao.buyNFT(nftID)).to.be.revertedWith("TokenID not owned");

    // Can't buy some random token.
    await expect(impdao.buyNFT(nftID.add(10))).to.be.revertedWith(
      "TokenID not owned"
    );
  });

  // NFT tests
  it("Should not accept unknown NFTs", async function () {
    const { impdao } = await loadContracts();

    const provider = waffle.provider;
    const [wallet] = provider.getWallets();

    // Deploy a second contract here
    const RandomWalkNFT = await ethers.getContractFactory("RandomWalkNFT");
    const rwnft2 = await RandomWalkNFT.deploy();
    await rwnft2.deployed();

    // Mint a new NFT on this
    await rwnft2.mint({ value: await rwnft2.getMintPrice() });

    // Try to transfer this unrecognized NFT to our contract, this should fail
    await expect(
      rwnft2["safeTransferFrom(address,address,uint256)"](
        wallet.address,
        impdao.address,
        0
      )
    ).to.be.revertedWith("NFT not recognized");
  });

  // NFT tests
  it("NFT is priced correctly", async function () {
    const { impdao, rwnft } = await loadContracts();

    const mintPrice = await rwnft.getMintPrice();
    const nftID = await rwnft.nextTokenId();

    await impdao.deposit({ value: mintPrice });

    const MINT_RATIO = await impdao.MINT_RATIO();

    // Contract should also have the NFT for sale, starting at 10x
    const startPrice = mintPrice.mul(MINT_RATIO).mul(1000).div(100);
    expect((await impdao.forSale(nftID)).startPrice).to.equal(startPrice);

    let expectedRatio = 4; // Start at 1/4th
    const minPrice = await impdao.NFT_MIN_PRICE();

    for (let i = 0; i < 3; i++) {
      // Now, fast forward a week
      await network.provider.send("evm_increaseTime", [3600 * 24 * 7]);
      await network.provider.send("evm_mine");

      const actualPrice = await impdao.buyNFTPrice(nftID);
      const priceDiff = startPrice.sub(actualPrice);

      const priceDiffRatio = startPrice.sub(minPrice).div(priceDiff);
      expect(priceDiffRatio).to.be.equal(expectedRatio);

      // Ratio becomes 4, 2, 1
      expectedRatio = expectedRatio / 2;
    }

    // Now advance it to almost one week, just before expiry
    // eslint-disable-next-line prettier/prettier
    await network.provider.send("evm_increaseTime", [(3600 * 24 * 9) - 10]);  // 9 days here brings us up to 30 days
    await network.provider.send("evm_mine");

    let actualPrice = await impdao.buyNFTPrice(nftID);
    expect(actualPrice.sub(minPrice), "min price").to.be.lte(
      ethers.utils.parseEther("0.0001") // Within 0.0001 IMPISH tokens
    );

    // Advance it beyond 30 days
    await network.provider.send("evm_increaseTime", [3600 * 1 * 1]);
    await network.provider.send("evm_mine");

    actualPrice = await impdao.buyNFTPrice(nftID);
    expect(actualPrice).to.be.equal(minPrice);
  });
});
