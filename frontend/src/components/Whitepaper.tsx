import { BigNumber } from "ethers";
import React from "react";
import { Col, Row } from "react-bootstrap";
import { format4Decimals } from "./utils";

type WhitepaperProps = {
  withdrawalAmount: BigNumber;
};
export default function Whitepaper({ withdrawalAmount }: WhitepaperProps) {
  return (
    <>
      <Row className="mb-5" style={{ textAlign: "center", backgroundColor: "#222", padding: "20px" }}>
        <h1>FAQ</h1>
      </Row>
      <Row className="justify-content-md-center">
        <Col md={6}>
          <div className="mb-3">
            <span style={{ fontWeight: "bold", color: "#ffd454" }}>What is ImpishDAO?</span>
            <br />
            ImpishDAO is a DAO that is attempting to win the{" "}
            <a style={{ color: "white" }} target="_blank" rel="noreferrer" href="https://www.randomwalknft.com/">
              RandomWalkNFT
            </a>{" "}
            prize.
            <br />
            <br />
            <a style={{ color: "white" }} target="_blank" rel="noreferrer" href="https://www.randomwalknft.com/">
              RandomWalkNFT
            </a>{" "}
            is a generative art project on Arbitrum with a twist. As RandomWalkNFTs are minted, the price to mint the
            next one goes up every time, so each NFT is more expensive to mint than the previous one.
            <br />
            <br />
            All the funds used to mint the NFTs are held in the RandomWalkNFT contract. If no one mints a new NFT for 30
            days, the last minter is awarded 50% of the money in the pool, which is currently ETH{" "}
            {format4Decimals(withdrawalAmount)}
            <br />
            <br />
            The goal of this project is to win that prize money and distribute it to evenly to all the contributors to
            ImpishDAO.
            <br />
            <br />
            Note that ImpishDAO is not affiliated in any way, and is independent from the RandomWalkNFT project.
          </div>

          <div className="mb-3">
            <span style={{ fontWeight: "bold", color: "#ffd454" }}>How will ImpishDAO win the prize?</span>
            <br />
            ImpishDAO aims to pool funds from users and buy the RandomWalkNFTs with the goal of being the last minter.
            All funds contributed to ImpishDAO are held in the ImpishDAO contract and are used to buy RandomWalkNFTs. If
            someone else mints a RandomWalkNFT and becomes the last minter (thereby outbidding us), ImpishDAO will try
            to raise more funds and buy the next RandomWalkNFT, thereby becoming the last minter again.
          </div>

          <div className="mb-3">
            <span style={{ fontWeight: "bold", color: "#ffd454" }}>What is the IMPISH token?</span>
            <br />
            When you contribute funds to the ImpishDAO, you are issued IMPISH tokens to represent your share of the
            ImpishDAO. These are standard ERC20 tokens, so you can use them just like you would any other token. The
            IMPISH tokens are issued at the ratio of 1 ETH = 1000 IMPISH.
            <br />
            <br />
            If the ImpishDAO wins the prize, you can redeem your IMPISH tokens for the prize money.
            <br />
            <br />
            The prize money is distributed in proportion of your IMPISH token holdings. So, if you contributed to
            ImpishDAO and the ImpishDAO got outbid at first, but it raised more money and eventually won the prize, you
            will still receive your portion of the prize, in proportion to your IMPISH token holdings.
          </div>

          <div className="mb-3">
            <span style={{ fontWeight: "bold", color: "#ffd454" }}>
              What happens to the RandomWalkNFTs purchased by ImpishDAO?
            </span>
            <br />
            The RandomWalkNFTs that the ImpishDAO purchases are held in the contract and are available for purchase
            using IMPISH tokens. The price for these starts off at 10x of the mint price, and linearly decreases to 1
            IMPISH over the period of 1 month.
            <br />
            <br />
            The IMPISH tokens used to purchase the NFTs are burned, decreasing the supply of IMPISH tokens (and
            therefore increasing the remaining holder's proportion of the prize)
          </div>

          <div className="mb-3">
            <span style={{ fontWeight: "bold", color: "#ffd454" }}>
              What happens if ImpishDAO loses or can't raise enough funds in time?
            </span>
            <br />
            If ImpishDAO loses the prize, you will most likely not get back anything. If there are any funds remaining
            in the contract, you'll be able to claim them in proportion to your IMPISH tokens, but the amount of ETH
            you'll get back will most likely be far lower than you contributed.
          </div>

          <div className="mb-3">
            <span style={{ fontWeight: "bold", color: "#ffd454" }}>How much can I contribute?</span>
            <br />
            To safeguard against any bugs in the smartcontract, ImpishDAO limits the amount of ETH it holds at any time
            to approximately 10 times the price of the next RandomWalkNFT. If the contract currently has more than this
            amount, it temporarily won't let you mint any more IMPISH tokens, until it spends the funds to buy the next
            RandomWalkNFT.
            <br />
            <br />
            Of course, you can still buy the IMPISH tokens on{" "}
            <a
              style={{ color: "white" }}
              href="https://app.uniswap.org/#/swap?inputCurrency=ETH&outputCurrency=0x36f6d831210109719d15abaee45b327e9b43d6c6"
              target="_blank"
              rel="noreferrer"
            >
              Uniswap
            </a>{" "}
            at anytime.
          </div>

          <div className="mb-3">
            <span style={{ fontWeight: "bold", color: "#ffd454" }}>
              What are the fees? How will the developers make money?
            </span>
            <br />
            There are no developer or royalty fees to use ImpishDAO (Apart from gas costs).
            <br />
            <br />
            The developers are in the same boat as the other members of the ImpishDAO. The developers plan to contribute
            to the DAO, holding the IMPISH tokens, and hope to win the prize. Note that there are no advantages to mint
            early in the ImpishDAO, since the winnings are distributed in proportion of IMPISH tokens, which are minted
            at a fixed price of 1 ETH = 1000 IMPISH tokens.
          </div>

          <div className="mb-3">
            <span style={{ fontWeight: "bold", color: "#ffd454" }}>Where are the contracts deployed?</span>
            <br />
            The ImpishDAO + Token contract is at{" "}
            <a
              style={{ color: "white" }}
              href="https://arbiscan.io/address/0x36f6d831210109719d15abaee45b327e9b43d6c6"
              target="_blank"
              rel="noreferrer"
            >
              0x36f6d831210109719d15abaee45b327e9b43d6c6
            </a>
            .
          </div>

          <div className="mb-3">
            <span style={{ fontWeight: "bold", color: "#ffd454" }}>
              What happens if there are bugs in the smartcontract?
            </span>
            <br />
            If there are any catastrophic bugs in the smart contract, the developers can "pause" the smartcontract. This
            will make the smartcontract stop accepting new deposits, and allow users to redeem any funds remaining in
            the smartcontract in proportion of their IMPISH token holdings.
            <br />
            <br />
            The smart contract is not upgradable, and the developers have no way to access the funds in the smart
            contract. The only thing the funds can be used for is to buy RandomWalkNFTs.
          </div>
        </Col>
      </Row>
    </>
  );
}
