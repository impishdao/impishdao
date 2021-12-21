import { Button, Col, Container, Form, Nav, Navbar, Row } from "react-bootstrap";
import { LinkContainer } from "react-router-bootstrap";
import { DappState, ERROR_CODE_TX_REJECTED_BY_USER } from "../AppState";
import { format4Decimals, formatUSD, secondsToDhms, THREE_DAYS } from "./utils";
import { Web3Provider } from "@ethersproject/providers";
import { BigNumber, Contract } from "ethers";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { setup_image } from "../spiralRenderer";
import { SelectableNFT } from "./NFTcard";
import { useNavigate } from "react-router-dom";

type SpiralProps = DappState & {
  provider?: Web3Provider;
  impdao?: Contract;
  rwnft?: Contract;
  impspiral?: Contract;

  connectWallet: () => void;

  readDappState: () => Promise<void>;
  readUserData: () => Promise<void>;
  showModal: (title: string, message: JSX.Element, modalCloseCallBack?: () => void) => void;
};

export function ImpishSpiral(props: SpiralProps) {
  // const canvasPreviewRef = useRef<HTMLCanvasElement>(null);
  const canvasCompanionRef = useRef<HTMLCanvasElement>(null);

  // By default, 3days remain
  
  const [timeRemaining, setTimeRemaining] = useState(THREE_DAYS);

  const [userRWNFTs, setUserRWNFTs] = useState<Array<BigNumber>>([]);
  const [selectedUserRW, setSelectedUserRW] = useState<BigNumber | null>(null);

  const [spiralType, setSpiralType] = useState("original");
  const [mintPrice, setMintPrice] = useState<BigNumber>(BigNumber.from(0));
  const [previewURL, setPreviewURL] = useState("");

  const nav = useNavigate();

  // Countdown timer.
  useEffect(() => {
    const timerID = setInterval(() => {
      setTimeRemaining(timeRemaining - 1);
    }, 1000);

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
        setTimeRemaining((lastMintTime.toNumber() + THREE_DAYS) - (Date.now() / 1000));
      })
  }, [])

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
      if (!props.selectedAddress || !props.rwnft) {
        return;
      }
      // Limit to 20 tokens for now
      const tokenIDs = ((await props.rwnft.walletOfOwner(props.selectedAddress)) as Array<BigNumber>).slice(0, 20);

      // Filter out tokens that have already been used.
      const shouldInclude = await Promise.all(
        tokenIDs.map(async (t) => {
          const minted = await props.impspiral?.mintedRWs(t);
          return !minted;
        })
      );

      const filteredTokenIDs = tokenIDs.filter((t, i) => shouldInclude[i]);

      // Limit to 20 for now.
      setUserRWNFTs(filteredTokenIDs);

      // Also get the latest mint price
      if (props.impspiral) {
        setMintPrice(await props.impspiral.getMintPrice());
      }
    })();
  }, [props.selectedAddress, props.rwnft, props.impspiral]);

  // Select the first RW NFT when it loads
  useEffect(() => {
    if (userRWNFTs.length > 0) {
      setSelectedUserRW(userRWNFTs[0]);
    }
  }, [userRWNFTs]);

  useEffect(() => {
    (async () => {
      if (!props.selectedAddress || !props.rwnft || !selectedUserRW) {
        return;
      }

      const seed = (await props.rwnft.seeds(selectedUserRW)) as string;
      setPreviewURL(`/spiral_image/seed/${seed}/300.png`);
    })();
  }, [props.selectedAddress, props.rwnft, selectedUserRW]);

  // const randomSpiral = async () => {
  //   if (canvasPreviewRef.current) {
  //     const r = new Uint8Array(32);
  //     window.crypto.getRandomValues(r);

  //     setup_image(canvasPreviewRef.current, "main", toHexString(r));
  //   }
  // };

  const mintSpiral = async () => {
    if (!props.impspiral) {
      return;
    }

    try {
      if (spiralType === "original") {
        const id = await props.impspiral._tokenIdCounter();
        let tx = await props.impspiral.mintSpiralRandom({ value: await props.impspiral.getMintPrice() });
        await tx.wait();
        props.showModal("Yay!", <div>You successfully minted an Original Spiral. You can now view it.</div>, () => {
          nav(`/spirals/detail/${id}`);
        });
      } else {
        if (selectedUserRW) {
          const id = await props.impspiral._tokenIdCounter();
          let tx = await props.impspiral.mintSpiralWithRWNFT(selectedUserRW, {
            value: await props.impspiral.getMintPrice(),
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

      let msg: string | undefined;
      if (e?.code === ERROR_CODE_TX_REJECTED_BY_USER) {
        // User cancelled, so do nothing
        msg = undefined;
      } else {
        msg = `Error: ${e?.data?.message}`;
      }

      if (msg) {
        props.showModal("Error Minting Impish Spiral!", <div>{msg}</div>);
      }
    }
  };

  return (
    <>
      <Navbar fixed="top" style={{ borderBottom: "1px solid #fff" }} variant="dark" bg="dark">
        <Container>
          <Navbar.Brand href="/">ImpishDAO</Navbar.Brand>
          <Nav className="me-auto">
            <LinkContainer to="/">
              <Nav.Link>Home</Nav.Link>
            </LinkContainer>
            <div className="vr" style={{ marginLeft: "10px", marginRight: "10px" }}></div>
            <LinkContainer to="/spirals">
              <Nav.Link>Spirals</Nav.Link>
            </LinkContainer>
            <LinkContainer to="/spirals/top10">
              <Nav.Link>Winning Spirals</Nav.Link>
            </LinkContainer>
            {props.selectedAddress && (
              <LinkContainer to={`/spirals/wallet/${props.selectedAddress}`}>
                <Nav.Link>Your Wallet</Nav.Link>
              </LinkContainer>
            )}
          </Nav>
          {!props.selectedAddress && (
            <Button className="connect" variant="warning" onClick={props.connectWallet}>
              Connect Wallet
            </Button>
          )}
          {props.selectedAddress && (
            <>
              <div style={{ marginRight: "10px" }}>Wallet: {format4Decimals(props.tokenBalance)} IMPISH</div>
              <Button className="address" variant="warning">
                {props.selectedAddress}
              </Button>
            </>
          )}
        </Container>
      </Navbar>

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
                  <Form>
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

              {spiralType === "companion" && (
                <>
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
                            marginLeft: "-100px"
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
                            <span style={{ color: "#ffc106" }}>Step 3:</span>{" "}
                            Mint!
                          </h5>
                          <div>
                            Mint Price: ETH {format4Decimals(mintPrice)} {formatUSD(mintPrice, props.lastETHPrice)}
                          </div>
                          <Button style={{ marginTop: "10px" }} variant="warning" onClick={mintSpiral}>
                            Mint
                          </Button>
                        </div>
                      </Col>
                      <Col xs={3} style={{ marginTop: "-50px" }}>
                        <div>Preview</div>
                        <div style={{ border: "solid 1px", borderRadius: "10px", padding: "10px", marginRight: '-20px' }}>
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

              {spiralType === "original" && (
                <Row>
                  <Col xs={{ offset: 3 }} style={{ textAlign: "left" }}>
                    <h5 style={{ marginTop: "30px" }}>
                      <span style={{ color: "#ffc106" }}>Step 2:</span> Mint!
                    </h5>
                    <div>
                      Mint Price: ETH {format4Decimals(mintPrice)} {formatUSD(mintPrice, props.lastETHPrice)}
                    </div>
                    <Button style={{ marginTop: "10px" }} variant="warning" onClick={mintSpiral}>
                      Mint
                    </Button>
                  </Col>
                </Row>
              )}

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
                The game ends when no one mints a new NFT for 48 hours. After this, no more Spiral NFTs can be minted
              </li>
              <li>
                The last 10 Spiral NFTs minted will win the prize pool!
                <ul>
                  <li>The last NFT minted after the game stops gets 10% of all the ETH in the contract.</li>
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
            RandomWalkNFT. It will share the same random walk and the color pallette.
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
            are a "Random Walk", but plotted with polar co-ordinates with a slight spiral bias.
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
