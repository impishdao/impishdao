import { Button, Container, Nav, Navbar, OverlayTrigger, Tooltip } from "react-bootstrap";
import { LinkContainer } from "react-router-bootstrap";
import { useLocation } from "react-router-dom";

import { DappState } from "../AppState";
import { format4Decimals, formatkmb } from "./utils";

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
  } else if (loc.pathname === "/impishdao" || loc.pathname.startsWith("/impishdao")) {
    expandSection = 3;
  } else if (loc.pathname === "/crystals" || loc.pathname.startsWith("/crystals")) {
    expandSection = 4;
  }

  return (
    <Navbar fixed="top" style={{ borderBottom: "1px solid #fff" }} variant="dark" bg="dark">
      <Container>
        <Navbar.Brand href="/spirals">IMPISH</Navbar.Brand>
        <Nav className="me-auto">
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
          <div className="vr" style={{ marginLeft: "10px", marginRight: "10px" }}></div>
          <LinkContainer to="/impishdao">
            <Nav.Link>ImpishDAO</Nav.Link>
          </LinkContainer>
          {expandSection === 3 && (
            <>
              <LinkContainer to="/impishdao/buy">
                <Nav.Link>NFTs for Sale</Nav.Link>
              </LinkContainer>
              <LinkContainer to="/impishdao/faq">
                <Nav.Link>FAQ</Nav.Link>
              </LinkContainer>
            </>
          )}

          <div className="vr" style={{ marginLeft: "10px", marginRight: "10px" }}></div>
          <LinkContainer to="/crystals">
            <Nav.Link>Crystals</Nav.Link>
          </LinkContainer>
        </Nav>
        {!props.selectedAddress && (
          <Button className="connect" variant="warning" onClick={props.connectWallet}>
            Connect Wallet
          </Button>
        )}
        {props.selectedAddress && (
          <>
            <div style={{ marginRight: "10px" }}>
              {(expandSection === 1 || expandSection === 2 || expandSection === 4) && (
                <OverlayTrigger
                  placement="bottom"
                  overlay={
                    <Tooltip id={`tooltip-spiralbits`}>{format4Decimals(props.spiralBitsBalance)} SPIRALBITS</Tooltip>
                  }
                >
                  <span>{formatkmb(props.spiralBitsBalance)} SPIRALBITS</span>
                </OverlayTrigger>
              )}
              {expandSection === 3 && <span>{format4Decimals(props.impishTokenBalance)} IMPISH</span>}
            </div>
            <Button className="address" variant="warning">
              {props.selectedAddress}
            </Button>
          </>
        )}
      </Container>
    </Navbar>
  );
}
