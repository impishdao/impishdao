import { Button, Col, Container, Nav, Navbar, Row } from "react-bootstrap";
import { LinkContainer } from "react-router-bootstrap";
import { DappState } from "../AppState";
import { format4Decimals, secondsToDhms } from "./utils";
import { Web3Provider } from "@ethersproject/providers";
import { BigNumber, Contract } from "ethers";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { setup_image } from "../spiralRenderer";
import { SelectableNFT } from "./NFTcard";

type SpiralProps = DappState & {
  provider?: Web3Provider;
  impdao?: Contract;
  rwnft?: Contract;

  connectWallet: () => void;

  readDappState: () => Promise<void>;
  readUserData: () => Promise<void>;
  showModal: (title: string, message: JSX.Element) => void;
};

export function ImpishSpiral(props: SpiralProps) {
  const canvasPreviewRef = useRef<HTMLCanvasElement>(null);
  const canvasCompanionRef = useRef<HTMLCanvasElement>(null);

  const mintStart = 1640113200;
  const [timeRemaining, setTimeRemaining] = useState(mintStart - Date.now() / 1000);

  const [userRWNFTs, setUserRWNFTs] = useState<Array<BigNumber>>([]);
  const [selectedUserRW, setSelectedUserRW] = useState<BigNumber | null>(null);

  // Countdown timer.
  useEffect(() => {
    const timerID = setInterval(() => {
      setTimeRemaining(timeRemaining - 1);
    }, 1000);

    return function cleanup() {
      clearInterval(timerID);
    };
  });

  // Draw on the canvas after the screen is loaded.
  useLayoutEffect(() => {
    if (canvasCompanionRef.current && !canvasCompanionRef.current.getAttribute("spiralPresent")) {
      canvasCompanionRef.current.setAttribute("spiralPresent", "true");
      setup_image(canvasCompanionRef.current, "0x532b99fbdb1156fb7970b0ad4e4c0718bdb360bec4e040734c7f549e62c54819");
    }
  });

  // Fetch the user's wallet's RW NFTs.
  useEffect(() => {
    (async () => {
      if (!props.selectedAddress || !props.rwnft) {
        return;
      }

      console.log("Calling RWNFT walletOfOwner");
      const tokenIDs = (await props.rwnft.walletOfOwner(props.selectedAddress)) as Array<BigNumber>;

      // Limit to 20 for now.
      setUserRWNFTs(tokenIDs.slice(0, 20));
    })();
  }, [props.selectedAddress, props.rwnft]);

  // Select the first RW NFT when it loads
  useEffect(() => {
    if (userRWNFTs.length > 0) {
      setSelectedUserRW(userRWNFTs[0]);
    }
  }, [userRWNFTs]);

  // When a UserRWNFT is selected, update the preview
  useEffect(() => {
    // Fetch the Seed
    (async () => {
      if (canvasPreviewRef.current && selectedUserRW) {
        if (!props.selectedAddress || !props.rwnft) {
          return;
        }

        const seed = (await props.rwnft.seeds(selectedUserRW)) as string;
        setup_image(canvasPreviewRef.current, seed);
      }
    })();
  }, [props.rwnft, props.selectedAddress, selectedUserRW]);

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

      <div style={{ textAlign: "center", marginTop: "-50px", paddingTop: "100px" }}>
        <h1>Chapter 1: The Spirals</h1>

        <Row className="mt-4">
          <div style={{ display: "flex", justifyContent: "center" }}>
            <div style={{ padding: "20px", marginRight: "20px", textAlign: "center", minWidth: "800px" }}>
              {props.selectedAddress && (
                <>
                  <h4>Your RandomWalkNFTs</h4>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "center",
                      gap: "10px",
                      rowGap: "20px",
                      margin: "20px",
                      flexWrap: "wrap",
                      maxWidth: "800px",
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
                </>
              )}

              {!props.selectedAddress && (
                <div className="mt-4">
                  <div style={{ marginTop: "100px" }}>
                    Connect your Metamask wallet
                    <br />
                    to view your RandomWalkNFTs
                  </div>
                  <br />
                  <Button className="connect" variant="warning" onClick={props.connectWallet}>
                    Connect Wallet
                  </Button>
                </div>
              )}

              {/* <div style={{ display: "flex", justifyContent: "center", gap: "10px" }}>
                <Button variant="warning" disabled>
                  Mint Companion
                </Button>
                <Button variant="warning" disabled>
                  Mint Random
                </Button>
              </div> */}
            </div>
            <div style={{ padding: "20px" }}>
              <h4 className="mb-2">Companion Spiral NFT Preview</h4>
              <div style={{ border: "solid 1px", borderRadius: "10px", padding: "10px" }}>
                <canvas ref={canvasPreviewRef} width="400px" height="400px"></canvas>
              </div>
            </div>
          </div>
        </Row>
        <Row>
          <div className="mt-2" style={{ fontWeight: "bold", color: "#ffd454" }}>
            Minting Starts In
          </div>
          <div className="mb-4" style={{ fontFamily: "monospace" }}>
            {secondsToDhms(timeRemaining)}
          </div>
        </Row>
      </div>

      <Row className="mb-5" style={{ textAlign: "center", backgroundColor: "#222", padding: "20px" }}>
        <h1>FAQ</h1>
      </Row>
      <Row className="justify-content-md-center">
        <Col md={6}>
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
              <li>You can choose to mint a Random spiral, or a "Companion Spiral" to your RandomWalkNFT</li>
              <ul>
                <li>
                  If you mint a Companion Spiral, 1/3rd of your mint price is returned back to you as IMPISH tokens!
                </li>
                <li>If you mint a Random Spiral, you'll get an original spiral that doesn't look like any other!</li>
              </ul>
            </ul>
          </div>

          <div className="mb-3">
            <span style={{ fontWeight: "bold", color: "#ffd454" }}>What is a Companion Spiral?</span>
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
            If you mint a companion spiral, 1/3rd of your mint price is used to purchase{" "}
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
            <span style={{ fontWeight: "bold", color: "#ffd454" }}>How are spirals generated?</span>
            <br />
            The spirals are programmatically generated from a random seed (or your companion RandomWalkNFT's seed). They
            are a "Random Walk", but plotted with polar co-ordinates with a slight spiral bias.
            <br />
            You can click on a Spiral to see it animate! Go ahead and try it :)
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
