import { Button, Col, FloatingLabel, Form, Row } from "react-bootstrap";
import { DappFunctions, DappState } from "../AppState";
import { format4Decimals, formatUSD, range, secondsToDhms, THREE_DAYS } from "./utils";
import { BigNumber } from "ethers";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { setup_image } from "../spiralRenderer";
import { SelectableNFT } from "./NFTcard";
import { useNavigate } from "react-router-dom";
import { Navigation } from "./Navigation";
import { Eth1, Eth1k, Eth1M, Eth2B, MultiTxItem } from "./walletutils";

type SpiralProps = DappState & DappFunctions & {};

type SpiralType = "original" | "companion" | "mega";
enum Currency {
  "ETH",
  "MAGIC",
}

export function ImpishSpiral(props: SpiralProps) {
  // const canvasPreviewRef = useRef<HTMLCanvasElement>(null);
  const canvasCompanionRef = useRef<HTMLCanvasElement>(null);

  // By default, 3days remain
  const [timeRemaining, setTimeRemaining] = useState(THREE_DAYS);

  const [userRWNFTs, setUserRWNFTs] = useState<Array<BigNumber>>([]);
  const [selectedUserRW, setSelectedUserRW] = useState<BigNumber | null>(null);

  const [spiralType, setSpiralType] = useState<SpiralType>("mega");
  const [spiralMintPrice, setSpiralMintPrice] = useState<BigNumber>(BigNumber.from(0));
  const [rwMintPrice, setRwMintPrice] = useState<BigNumber>(BigNumber.from(0));

  const [ethPer1MSpiralBits, setEthPer1MSpiralBits] = useState(BigNumber.from(0));
  const [ethPer10kMagic, setEthPer10kMagic] = useState(BigNumber.from(0));
  const [buyCurrency, setBuyCurrency] = useState(Currency.ETH);

  const [numSpirals, setNumSpirals] = useState(1);
  const [previewURL, setPreviewURL] = useState("");

  const nav = useNavigate();

  // Countdown timer.
  useEffect(() => {
    const timerID = setInterval(() => {
      setTimeRemaining(timeRemaining - 60);
    }, 1000 * 60);

    return function cleanup() {
      clearInterval(timerID);
    };
  }, [timeRemaining]);

  useEffect(() => {
    fetch("/spiralapi/spiraldata")
      .then((data) => data.json())
      .then((j) => {
        const lastMintTime = BigNumber.from(j.lastMintTime || 0);
        console.log(`Last mint time was ${lastMintTime.toNumber()}`);
        setTimeRemaining(lastMintTime.toNumber() + THREE_DAYS - Date.now() / 1000);
      });

    // Fetch prices
    fetch("/marketapi/uniswapv3prices")
      .then((r) => r.json())
      .then((data) => {
        const { ETHper1MSPIRALBITS, ETHper10kMagic } = data;
        setEthPer1MSpiralBits(BigNumber.from(ETHper1MSPIRALBITS));
        setEthPer10kMagic(BigNumber.from(ETHper10kMagic));
      });
  }, []);

  // Draw on the canvas after the screen is loaded.
  useLayoutEffect(() => {
    if (canvasCompanionRef.current) {
      setup_image(
        canvasCompanionRef.current,
        "faq",
        "0x532b99fbdb1156fb7970b0ad4e4c0718bdb360bec4e040734c7f549e62c54819"
      );
    }
  });

  // Fetch the user's wallet's RW NFTs.
  useEffect(() => {
    (async () => {
      if (!props.selectedAddress || !props.contracts) {
        return;
      }
      // Limit to 20 tokens for now
      const tokenIDs = ((await props.contracts.rwnft.walletOfOwner(props.selectedAddress)) as Array<BigNumber>).slice(
        0,
        20
      );

      // Filter out tokens that have already been used.
      const shouldInclude = await Promise.all(
        tokenIDs.map(async (t) => {
          const minted = await props.contracts?.impspiral.mintedRWs(t);
          return !minted;
        })
      );

      const filteredTokenIDs = tokenIDs.filter((t, i) => shouldInclude[i]);

      // Limit to 20 for now.
      setUserRWNFTs(filteredTokenIDs);

      // Also get the latest mint price
      if (props.contracts) {
        setSpiralMintPrice(await props.contracts.impspiral.getMintPrice());
        setRwMintPrice(await props.contracts.rwnft.getMintPrice());
      }
    })();
  }, [props.selectedAddress, props.contracts]);

  // Select the first RW NFT when it loads
  useEffect(() => {
    if (userRWNFTs.length > 0) {
      setSelectedUserRW(userRWNFTs[0]);
    }
  }, [userRWNFTs]);

  useEffect(() => {
    (async () => {
      if (!props.selectedAddress || !props.contracts || !selectedUserRW) {
        return;
      }

      const seed = (await props.contracts.rwnft.seeds(selectedUserRW)) as string;
      setPreviewURL(`/spiral_image/seed/${seed}/300.png`);
    })();
  }, [props.selectedAddress, props.contracts, selectedUserRW]);

  const calcMultiSpiralPrice = (numSpirals: number): BigNumber => {
    let amountNeeded = BigNumber.from(0);
    let basePrice = spiralMintPrice;
    for (let i = 0; i < numSpirals; i++) {
      amountNeeded = amountNeeded.add(basePrice);
      // Mint price increases 0.5% every time
      basePrice = basePrice.mul(1005).div(1000);
    }

    return amountNeeded;
  };

  const calcMegaMintPrice = (numSpirals: number): BigNumber => {
    // First, calculate the price needed for RandomWalkNFTs
    let amountNeeded = BigNumber.from(0);
    let basePrice = rwMintPrice;
    for (let i = 0; i < numSpirals; i++) {
      amountNeeded = amountNeeded.add(basePrice);
      // Mint price increases 0.5% every time
      basePrice = basePrice.mul(10011).div(10000);
    }

    // Add price to mint spirals
    amountNeeded = amountNeeded.add(calcMultiSpiralPrice(numSpirals));

    // Minting Crystals is free, so no need to add that
    // Calculate ETH needed to grow the Crystals to max.
    // These are swapped from Uniswap, so we need to get that number
    // 1K SpiralBits * num of crystals * 70 growth * max number of Symmetries
    const spiralBitsNeeded = Eth1k.mul(numSpirals).mul(70).mul(8);
    const EthNeededToGrow = ethPer1MSpiralBits.mul(spiralBitsNeeded).div(Eth1M);
    amountNeeded = amountNeeded.add(EthNeededToGrow);

    return amountNeeded;
  };

  const multiMintPriceETH = calcMultiSpiralPrice(numSpirals);
  const megaMintPriceETH = calcMegaMintPrice(numSpirals);

  const priceInMagic = (priceInEth: BigNumber): BigNumber => {
    if (ethPer10kMagic.eq(0)) {
      return BigNumber.from(0);
    }

    return priceInEth.mul(10000).mul(Eth1).div(ethPer10kMagic);
  };

  const megaMint = async () => {
    if (!props.contracts || spiralType !== "mega" || !props.selectedAddress) {
      return;
    }

    try {
      const txns: MultiTxItem[] = [];

      if (buyCurrency === Currency.ETH) {
        txns.push({
          title: `Minting ${numSpirals} Mega Sets`,
          tx: () =>
            props.selectedAddress
              ? props.contracts?.buywitheth.megaMint(props.selectedAddress, numSpirals, { value: megaMintPriceETH })
              : undefined,
        });
      } else if (buyCurrency === Currency.MAGIC) {
        const magicAmount = priceInMagic(megaMintPriceETH);
        console.log(`${props.magicBalance} - ${magicAmount}`);
        if (props.magicBalance.lt(magicAmount)) {
          props.showModal(
            "Not enough MAGIC",
            <div>
              Not enough MAGIC tokens. You have {format4Decimals(props.magicBalance)}, need{" "}
              {format4Decimals(magicAmount)}
            </div>
          );
          return;
        }

        // Check if approval is needed.
        if (
          (await props.contracts.magic.allowance(props.selectedAddress, props.contracts.buywitheth.address)).lt(
            magicAmount
          )
        ) {
          txns.push({
            title: "Approving MAGIC",
            tx: () => props.contracts?.magic.approve(props.contracts.buywitheth.address, Eth2B),
          });
        }

        txns.push({
          title: `Minting ${numSpirals} Mega Sets with MAGIC`,
          tx: () =>
            props.selectedAddress
              ? props.contracts?.buywitheth.megaMintWithMagic(props.selectedAddress, numSpirals, magicAmount)
              : undefined,
        });
      }

      const success = await props.executeMultiTx(txns);
      if (success) {
        props.showModal(
          `Minted!`,
          <div>
            Your RandomWalkNFTs, Spirals and Crystals have been minted and staked.
            <br />
            <br />
            You can view them on your staking page.
          </div>,
          () => nav("/spiralstaking")
        );
      }
    } catch (e: any) {
      console.log(JSON.stringify(e));
    }
  };

  const mintSpiral = async () => {
    if (!props.contracts || !props.selectedAddress) {
      return;
    }

    const txns: MultiTxItem[] = [];

    try {
      if (spiralType === "original") {
        if (buyCurrency === Currency.ETH) {
          const price = calcMultiSpiralPrice(numSpirals);
          txns.push({
            title: "Minting Spirals",
            tx: () => props.contracts?.multimint.multiMint(numSpirals, { value: price }),
          });

          const success = await props.executeMultiTx(txns);
          if (success) {
            props.showModal(
              "Yay!",
              <div>You successfully minted {numSpirals} Original Spirals. You can now view them in your wallet.</div>,
              () => {
                nav(`/wallet/${props.selectedAddress}/spirals`);
              }
            );
          }
        } else if (buyCurrency === Currency.MAGIC) {
          const magicAmount = priceInMagic(multiMintPriceETH);

          if (
            (await props.contracts.magic.allowance(props.selectedAddress, props.contracts.buywitheth.address)).lt(
              magicAmount
            )
          ) {
            txns.push({
              title: "Approve MAGIC",
              tx: () => props.contracts?.magic.approve(props.contracts.buywitheth.address, Eth2B),
            });
          }

          txns.push({
            title: "Mint Spirals with MAGIC",
            tx: () => props.contracts?.buywitheth.multiMintWithMagic(numSpirals, magicAmount),
          });

          const success = await props.executeMultiTx(txns);
          if (success) {
            props.showModal(
              "Yay!",
              <div>You successfully minted {numSpirals} Original Spirals. You can now view them in your wallet.</div>,
              () => {
                nav(`/wallet/${props.selectedAddress}/spirals`);
              }
            );
          }
        }
      } else {
        if (selectedUserRW) {
          const id = await props.contracts.impspiral._tokenIdCounter();
          let tx = await props.contracts.impspiral.mintSpiralWithRWNFT(selectedUserRW, {
            value: await props.contracts.impspiral.getMintPrice(),
          });
          await tx.wait();
          props.showModal(
            "Yay!",
            <div>You successfully minted a RandomWalkNFT Companion Spiral. You can now to view it.</div>,
            () => {
              nav(`/spirals/detail/${id}`);
            }
          );
        } else {
          console.log("Error, no user selected RandomWalkNFT found!");
        }
      }
    } catch (e: any) {
      console.log(e);
    }
  };

  return (
    <>
      <Navigation {...props} />

      <div className="withSpiralBackground" style={{ textAlign: "center", marginTop: "-50px", paddingTop: "100px" }}>
        <h1>Chapter 1: The Spirals</h1>
        <Row className="mt-1">
          <div>
            Minting is open for <span style={{ color: "#ffd454" }}>{secondsToDhms(timeRemaining)}</span>
          </div>
        </Row>
        <Row className="mt-3">
          {props.selectedAddress && (
            <>
              <Row style={{ marginTop: "50px" }}>
                <Col xs={{ offset: 3 }} style={{ textAlign: "left" }}>
                  <h5>
                    <span style={{ color: "#ffc106" }}>Step 1:</span> What kind of Spiral?
                  </h5>
                  <Form style={{ fontSize: "1.1rem" }}>
                    <Form.Check
                      checked={spiralType === "mega"}
                      label="Mega Set"
                      type="radio"
                      onChange={() => setSpiralType("mega")}
                      id="minttype"
                    />
                    <Form.Check
                      checked={spiralType === "original"}
                      label="Original Spiral"
                      type="radio"
                      onChange={() => setSpiralType("original")}
                      id="minttype"
                    />
                    <Form.Check
                      checked={spiralType === "companion"}
                      label="RandomWalkNFT Companion Spiral"
                      type="radio"
                      onChange={() => setSpiralType("companion")}
                      id="minttype"
                    />
                  </Form>
                </Col>
              </Row>

              {spiralType === "mega" && (
                <>
                  <Row className="mt-3">
                    <Col xs={{ offset: 3, span: 6 }} style={{ textAlign: "left", background: "rgba(0,0,0,0.5)" }}>
                      <span>
                        A Mega Set mints a RandomWalkNFT, its companion Spiral and maxed out Gen0 Crystal, and stakes
                        all of them. The SPIRALBITS and IMPISH tokens generated are also staked.
                      </span>
                    </Col>
                  </Row>
                  <Row>
                    <Col xs={{ offset: 3 }} style={{ textAlign: "left" }}>
                      <h5 style={{ marginTop: "30px" }}>
                        <span style={{ color: "#ffc106" }}>Step 2:</span> Mint Mega Set!
                      </h5>
                      <div>
                        Total Price:{" "}
                        {buyCurrency === Currency.ETH && (
                          <>
                            ETH {format4Decimals(megaMintPriceETH)} {formatUSD(megaMintPriceETH, props.lastETHPrice)}
                          </>
                        )}
                        {buyCurrency === Currency.MAGIC && (
                          <>
                            MAGIC {format4Decimals(priceInMagic(megaMintPriceETH))}{" "}
                            {formatUSD(megaMintPriceETH, props.lastETHPrice)}
                          </>
                        )}
                      </div>
                      <div style={{ display: "flex", flexDirection: "row", alignItems: "flex-end", gap: "10px" }}>
                        <FloatingLabel label="Currency" style={{ color: "black", width: "100px" }}>
                          <Form.Select
                            value={buyCurrency}
                            onChange={(e) => setBuyCurrency(parseInt(e.currentTarget.value))}
                          >
                            <option value={Currency.ETH}>{Currency[Currency.ETH]}</option>
                            <option value={Currency.MAGIC}>{Currency[Currency.MAGIC]}</option>
                          </Form.Select>
                        </FloatingLabel>
                        <FloatingLabel label="Number of Mega Sets" style={{ color: "black", width: "200px" }}>
                          <Form.Select
                            value={numSpirals.toString()}
                            onChange={(e) => setNumSpirals(parseInt(e.currentTarget.value))}
                          >
                            {range(10, 1).map((n) => {
                              return (
                                <option key={n} value={n}>
                                  {n}
                                </option>
                              );
                            })}
                          </Form.Select>
                        </FloatingLabel>
                        <Button style={{ marginTop: "10px", height: "58px" }} variant="warning" onClick={megaMint}>
                          Mint Mega Set
                        </Button>
                      </div>
                    </Col>
                  </Row>
                </>
              )}

              {spiralType === "original" && (
                <>
                  <Row className="mt-3">
                    <Col xs={{ offset: 3, span: 6 }} style={{ textAlign: "left", background: "rgba(0,0,0,0.5)" }}>
                      <span>A brand new Spiral with an Original, one-of-a-kind seed</span>
                    </Col>
                  </Row>
                  <Row>
                    <Col xs={{ offset: 3 }} style={{ textAlign: "left" }}>
                      <h5 style={{ marginTop: "30px" }}>
                        <span style={{ color: "#ffc106" }}>Step 2:</span> Mint!
                      </h5>
                      <div>
                        Mint Price:
                        {buyCurrency === Currency.ETH
                          ? ` ETH ${format4Decimals(multiMintPriceETH)}`
                          : ` MAGIC ${format4Decimals(priceInMagic(multiMintPriceETH))}`}{" "}
                        {formatUSD(multiMintPriceETH, props.lastETHPrice)}
                      </div>
                      <div style={{ display: "flex", flexDirection: "row", alignItems: "flex-end", gap: "10px" }}>
                        <FloatingLabel label="Currency" style={{ color: "black", width: "100px" }}>
                          <Form.Select
                            value={buyCurrency}
                            onChange={(e) => setBuyCurrency(parseInt(e.currentTarget.value))}
                          >
                            <option value={Currency.ETH}>{Currency[Currency.ETH]}</option>
                            <option value={Currency.MAGIC}>{Currency[Currency.MAGIC]}</option>
                          </Form.Select>
                        </FloatingLabel>
                        <FloatingLabel label="Number of Spirals" style={{ color: "black", width: "200px" }}>
                          <Form.Select
                            value={numSpirals.toString()}
                            onChange={(e) => setNumSpirals(parseInt(e.currentTarget.value))}
                          >
                            {range(10, 1).map((n) => {
                              return (
                                <option key={n} value={n}>
                                  {n}
                                </option>
                              );
                            })}
                          </Form.Select>
                        </FloatingLabel>
                        <Button style={{ marginTop: "10px", height: "58px" }} variant="warning" onClick={mintSpiral}>
                          Mint
                        </Button>
                      </div>
                    </Col>
                  </Row>
                </>
              )}

              {spiralType === "companion" && (
                <>
                  <Row className="mt-3">
                    <Col xs={{ offset: 3, span: 6 }} style={{ textAlign: "left", background: "rgba(0,0,0,0.5)" }}>
                      <span>
                        A companion Spiral shares its seed with the RandomWalkNFT, which makes the Spiral look similar
                        to the RandomWalkNFT
                      </span>
                    </Col>
                  </Row>
                  <Row>
                    <Col xs={{ offset: 3 }} style={{ textAlign: "left" }}>
                      <h5 style={{ marginTop: "30px" }}>
                        <span style={{ color: "#ffc106" }}>Step 2:</span> Select a RandomWalkNFT to mint its companion
                      </h5>
                    </Col>
                  </Row>
                  {userRWNFTs.length > 0 && (
                    <Row>
                      <Col xs={{ offset: 3, span: 6 }}>
                        {/* <div>Your RandomWalkNFTs</div> */}
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "center",
                            gap: "10px",
                            rowGap: "20px",
                            margin: "20px",
                            flexWrap: "wrap",
                            marginLeft: "-100px",
                          }}
                        >
                          {userRWNFTs.map((tokenId) => (
                            <SelectableNFT
                              key={tokenId.toString()}
                              tokenId={tokenId}
                              selected={tokenId.eq(selectedUserRW || -1)}
                              onClick={() => {
                                setSelectedUserRW(tokenId);
                              }}
                            />
                          ))}
                        </div>
                        <div style={{ textAlign: "left" }}>
                          <h5 style={{ marginTop: "30px" }}>
                            <span style={{ color: "#ffc106" }}>Step 3:</span> Mint!
                          </h5>
                          <div>
                            Mint Price: ETH {format4Decimals(spiralMintPrice)}{" "}
                            {formatUSD(spiralMintPrice, props.lastETHPrice)}
                          </div>
                          <Button style={{ marginTop: "10px" }} variant="warning" onClick={mintSpiral}>
                            Mint
                          </Button>
                        </div>
                      </Col>
                      <Col xs={3} style={{ marginTop: "-50px" }}>
                        <div>Preview</div>
                        <div
                          style={{ border: "solid 1px", borderRadius: "10px", padding: "10px", marginRight: "-20px" }}
                        >
                          <img src={previewURL} alt="spiral" />
                        </div>
                      </Col>
                    </Row>
                  )}

                  {userRWNFTs.length === 0 && (
                    <Row>
                      <Col xs={{ offset: 3 }}>
                        <div style={{ textAlign: "left" }}>
                          You don't have any available RandomWalkNFTs in your wallet
                          <br />
                          Please select "Original Spiral" to mint.
                        </div>
                      </Col>
                    </Row>
                  )}
                </>
              )}

              <Row className="mt-3">
                <Col xs={{ offset: 3 }} style={{ textAlign: "left" }}>
                  <div> --- OR ---</div>
                  <div className="mt-3">
                    Buy from{" "}
                    <a
                      style={{ color: "white" }}
                      target="_blank"
                      rel="noreferrer"
                      href="https://tofunft.com/collection/impish-spiral/items"
                    >
                      secondary market on TofuNFT
                    </a>
                  </div>
                </Col>
              </Row>

              <div style={{ marginBottom: "50px" }}></div>
            </>
          )}

          {!props.selectedAddress && (
            <div style={{ marginTop: "50px", marginBottom: "100px" }}>
              <div>
                Connect your Metamask wallet
                <br />
                to mint Spirals
              </div>
              <br />
              <Button className="connect" variant="warning" onClick={props.connectWallet}>
                Connect Wallet
              </Button>
            </div>
          )}
        </Row>
      </div>

      <Row className="mb-5" style={{ textAlign: "center", backgroundColor: "#222", padding: "20px" }}>
        <h1>FAQ</h1>
      </Row>
      <Row className="justify-content-md-center">
        <Col md={8}>
          <div className="mb-3">
            <span style={{ fontWeight: "bold", color: "#ffd454" }}>What are The Spirals?</span>
            <br />
            "The Spirals" are the first mini-game from ImpishDAO. They're inspired by the &nbsp;
            <a style={{ color: "white" }} target="_blank" rel="noreferrer" href="https://www.randomwalknft.com/">
              RandomWalkNFT
            </a>{" "}
            project. The Spirals are NFTs that anyone can mint on Arbitrum. It has the following rules:
            <br />
            <br />
            <ul>
              <li>Minting starts at ETH 0.005, and the price goes up by 0.5% for each Spiral NFT that is minted</li>
              <li>All the ETH used to mint is held in the NFT contract till the game ends.</li>
              <li>
                The game ends when no one mints a new NFT for 72 hours. After this, no more Spiral NFTs can be minted
              </li>
              <li>
                The last 10 Spiral NFTs minted will win the prize pool!
                <ul>
                  <li>The last NFT minted before the game stops gets 10% of all the ETH in the contract.</li>
                  <li>2nd place gets 9% of the prize ETH</li>
                  <li>3rd place gets 8% of the prize ETH</li>
                  <li>....</li>
                  <li>10th place gets 1% of the prize ETH</li>
                </ul>
              </li>
              <li>You can choose to mint an Original spiral, or a RandomWalkNFT Companion Spiral</li>
              <ul>
                <li>
                  If you mint a RandomWalkNFT Companion Spiral, 1/3rd of your mint price is returned back to you as
                  IMPISH tokens!
                </li>
                <li>If you mint an Original Spiral, you'll get an original spiral that doesn't look like any other!</li>
              </ul>
            </ul>
          </div>

          <div className="mb-3">
            <span style={{ fontWeight: "bold", color: "#ffd454" }}>What is a RandomWalkNFT Companion Spiral?</span>
            <br />
            If you own a RandomWalkNFT, you can choose to base your spiral on your RandomWalkNFT. Your spiral will share
            the generative seed with your RandomWalkNFT, which means your spiral will look similar to your
            RandomWalkNFT. It will share the same random walk and the color palette.
            <br />
            <Row>
              <Col xs={5}>
                <img src="https://randomwalknft.s3.us-east-2.amazonaws.com/003548_black.png" width={400} alt="" />
              </Col>
              <Col xs={2}>
                {" "}
                <div style={{ marginTop: "50px", fontSize: 96 }}>→</div>
              </Col>
              <Col xs={5}>
                <canvas ref={canvasCompanionRef} width="250px" height="250px"></canvas>
              </Col>
            </Row>
            <br />
            If you mint a RandomWalkNFT Companion spiral, 1/3rd of your mint price is used to purchase{" "}
            <a style={{ color: "white" }} target="_blank" rel="noreferrer" href="https://impishdao.com/">
              IMPISH tokens
            </a>{" "}
            and returned back to you. IMPISH tokens are{" "}
            <a style={{ color: "white" }} target="_blank" rel="noreferrer" href="https://impishdao.com/">
              ImpishDAO
            </a>{" "}
            tokens, which will pay out the RandomWalkNFT prize pool if ImpishDAO wins!
          </div>

          <div className="mb-3">
            <span style={{ fontWeight: "bold", color: "#ffd454" }}>
              Do I need to have my RandomWalkNFT in my wallet to mint a RandomWalkNFT companion spiral?
            </span>
            <br />
            Yes, you need to have your RandomWalkNFT in your wallet to mint it's companion spiral. Note that only
            owner's of an RandomWalkNFT can mint its companion spiral.
            <br />
            Each RandomWalkNFT can only have 1 companion spiral.
          </div>

          <div className="mb-3">
            <span style={{ fontWeight: "bold", color: "#ffd454" }}>What is a Mega Set?</span>
            <br />
            A "Mega Set" is a set of RandomWalkNFT, its companion Spiral and the Spiral's Gen0 Crystal, all minted
            together. Minting the mega set also buys enough SPIRALBITS to max out the Crystal to 100 size. The IMPISH
            tokens generated and any excess SPIRALBITS are staked along with all 3 NFTs to immediately begin generating
            SPIRALBITS.
            <br />
            <br />
            All of these are done in a single transaction and paid for in ETH. You can mint upto 10 Mega Sets at once.
          </div>

          <div className="mb-3">
            <span style={{ fontWeight: "bold", color: "#ffd454" }}>How is the ETH in the contract used?</span>
            <br />
            The ETH that is paid to mint Spirals is used in the following way:
            <ul>
              <li>55% of the ETH is reserved for rewards to the last 10 Spiral NFTs</li>
              <li>
                33% of the ETH is used to mint IMPISH tokens. ImpishDAO in turn uses the ETH to buy RandomWalkNFTs to
                win the RandomWalkNFT prize
              </li>
              <li>
                12% of the ETH can be withdrawn by the developers at the end of the game, and will be used for "Chapter
                2 - The SpiralBits"
              </li>
            </ul>
          </div>

          <div className="mb-3">
            <span style={{ fontWeight: "bold", color: "#ffd454" }}>How are spirals generated?</span>
            <br />
            The spirals are programmatically generated from a random seed (or your companion RandomWalkNFT's seed). They
            are a "Random Walk", but plotted with polar coordinates with a slight spiral bias.
            <br />
            You can click on a Spiral to see it animate! Go ahead and try it :)
          </div>

          <div className="mb-3">
            <span style={{ fontWeight: "bold", color: "#ffd454" }}>Where are the contracts deployed?</span>
            <br />
            The Impish Spiral is verified and deployed at{" "}
            <a
              style={{ color: "white" }}
              href="https://arbiscan.io/address/0xb6945b73ed554df8d52ecdf1ab08f17564386e0f"
              target="_blank"
              rel="noreferrer"
            >
              0xb6945b73ed554df8d52ecdf1ab08f17564386e0f
            </a>
            .
          </div>

          <div className="mb-3">
            <span style={{ fontWeight: "bold", color: "#ffd454" }}>
              Why does the price of spirals increase every time one is minted?
            </span>
            <br />
            The parameters of this game are chosen to make the game finishes quickly. Prices increase rapidly so that
            the game finishes, and we can move to Chapter 2!
            <br />
            The mint prices for the Spirals are expected to be:
            <br />
            <br />
            <ul>
              <li>Spiral #0 - 0.005 ETH</li>
              <li>Spiral #10 - 0.00525 ETH</li>
              <li>Spiral #100 - 0.008 ETH</li>
              <li>Spiral #500 - 0.06 ETH</li>
              <li>Spiral #1000 - 0.73 ETH</li>
              <li>Spiral #2000 - 107.42 ETH</li>
            </ul>
            This means, you can either mint early and get your Spiral for cheap, or you can mint late, and have a shot
            at winning a portion of the prize pool!
          </div>
          <div className="mb-3">
            <span style={{ fontWeight: "bold", color: "#ffd454" }}>Where are the contracts?</span>
            <br />
            The contracts will be published with verified sources on arbiscan.io before launch. Stay tuned!
            <br />
          </div>
        </Col>
      </Row>
    </>
  );
}
