import { Button, Container, Nav, Navbar } from "react-bootstrap";
import { LinkContainer } from "react-router-bootstrap";
import { DappState } from "../AppState";
import { format4Decimals } from "./utils";
import { Web3Provider } from "@ethersproject/providers";
import { Contract } from "ethers";
import { useLayoutEffect, useRef } from "react";
import { setup_image } from "../spiralRenderer";

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
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useLayoutEffect(() => {
    setTimeout(() => {
      if (canvasRef.current && !canvasRef.current.getAttribute("spiralPresent")) {
        canvasRef.current.setAttribute("spiralPresent", "true");
        setup_image(canvasRef.current);
      }
    }, 100);
  })

  return (
    <>
      <Navbar fixed="top" style={{ borderBottom: "1px solid #fff" }} variant="dark" bg="dark">
        <Container>
          <Navbar.Brand href="#home">ImpishDAO</Navbar.Brand>
          <Nav className="me-auto">
            <LinkContainer to="/">
              <Nav.Link>Home</Nav.Link>
            </LinkContainer>
            <div className="vr" style={{marginLeft: '10px', marginRight: '10px'}}></div>
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
        <canvas ref={canvasRef} style={{maxWidth: '400px'}}></canvas>
      </div>
    </>
  );
}
