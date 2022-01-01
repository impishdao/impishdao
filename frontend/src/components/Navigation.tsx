import { Button, Container, Nav, Navbar } from "react-bootstrap";
import { LinkContainer } from "react-router-bootstrap";
import { useLocation } from "react-router-dom";

import { DappState } from "../AppState";
import { format4Decimals } from "./utils";

type NavigationProps = DappState & {
  connectWallet: () => void;
};

export function Navigation(props: NavigationProps) {
  const loc = useLocation();

  let expandSection = 0;
  if (loc.pathname === "/" || loc.pathname.startsWith("/#")) {
    expandSection = 0;
  } else if (loc.pathname === "/spirals" || loc.pathname.startsWith("/spirals/")) {
    expandSection = 1;
  } else if (loc.pathname === "/spiralstaking" || loc.pathname.startsWith("/spiralstaking/")) {
    expandSection = 2;
  }

  return (
    <Navbar fixed="top" style={{ borderBottom: "1px solid #fff" }} variant="dark" bg="dark">
      <Container>
        <Navbar.Brand href="/">ImpishDAO</Navbar.Brand>
        <Nav className="me-auto">
          <LinkContainer to="/">
            <Nav.Link>Home</Nav.Link>
          </LinkContainer>
          {expandSection === 0 && (
            <>
              <Nav.Link href="#nftsforsale">NFTs for Sale</Nav.Link>
              <Nav.Link href="#stats">Stats</Nav.Link>
              <Nav.Link href="#whitepaper">FAQ</Nav.Link>
            </>
          )}
          <div className="vr" style={{ marginLeft: "10px", marginRight: "10px" }}></div>
          <LinkContainer to="/spirals">
            <Nav.Link>Spirals</Nav.Link>
          </LinkContainer>
          {expandSection === 1 && (
            <>
              <LinkContainer to="/spirals/top10">
                <Nav.Link>Leaderboard</Nav.Link>
              </LinkContainer>
              <LinkContainer to="/spirals/marketplace">
                <Nav.Link>Marketplace</Nav.Link>
              </LinkContainer>
              {props.selectedAddress && (
                <LinkContainer to={`/spirals/wallet/${props.selectedAddress}`}>
                  <Nav.Link>Wallet</Nav.Link>
                </LinkContainer>
              )}
            </>
          )}

          <div className="vr" style={{ marginLeft: "10px", marginRight: "10px" }}></div>
          <LinkContainer to="/spiralstaking">
            <Nav.Link>Staking</Nav.Link>
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
  );
}
