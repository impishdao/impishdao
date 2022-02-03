/* eslint-disable jsx-a11y/anchor-is-valid */
/* eslint-disable jsx-a11y/anchor-has-content */
import { Button, Card, Col, Form, OverlayTrigger, ProgressBar, Row, Table, Tooltip } from "react-bootstrap";
import { CrystalInfo, DappFunctions, DappState, NFTCardInfo, SpiralDetail } from "../AppState";
import { formatkmb, range, retryTillSucceed } from "./utils";
import { BigNumber, ethers } from "ethers";
import { useEffect, useState } from "react";
import { Navigation } from "./Navigation";
import { cloneDeep } from "lodash";
import { Link } from "react-router-dom";
import {
  Eth1,
  Eth1k,
  Eth1M,
  Eth2B,
  getCrystalImage,
  getMetadataForCrystalTokenIds,
  getNFTCardInfo,
  getSeedsForSpiralTokenIds,
  MultiTxItem,
} from "./walletutils";

type CrystalListDisplayProps = {
  title: string;
  pageSize: number;
  nfts?: Array<NFTCardInfo>;
  buttonName: string;
  buttonTooltip?: string;
  onButtonClick: (selection: Set<number>) => void;
  secondButtonName?: string;
  secondButtonTooltip?: string;
  onSecondButtonClick?: (selection: Set<number>) => void;
  refreshCounter: number;
  nothingMessage?: JSX.Element;
};
const CrystalListDisplay = ({
  pageSize,
  nfts,
  title,
  buttonName,
  buttonTooltip,
  onButtonClick,
  secondButtonName,
  secondButtonTooltip,
  onSecondButtonClick,
  refreshCounter,
  nothingMessage,
}: CrystalListDisplayProps) => {
  const [startPage, setStartPage] = useState(0);
  const [selection, setSelection] = useState<Set<number>>(new Set());

  useEffect(() => {
    setSelection(new Set());
  }, [refreshCounter]);

  const toggleInSelection = (tokenNumber: number) => {
    if (selection.has(tokenNumber)) {
      const newSelection = cloneDeep(selection);
      newSelection.delete(tokenNumber);
      setSelection(newSelection);
    } else {
      const newSelection = cloneDeep(selection);
      newSelection.add(tokenNumber);
      setSelection(newSelection);
    }
  };

  const selectAll = () => {
    if (nfts && nfts.length > 0) {
      const newSelection = nfts.slice(0, 50).map((nft) => nft.getContractTokenId());
      setSelection(new Set(newSelection));
    }
  };

  const numPages = nfts ? Math.floor((nfts.length - 1) / pageSize) + 1 : 1;

  const PageList = () => {
    return (
      <>
        <Row style={{ marginTop: "20px" }}>
          <h5>{title}</h5>
        </Row>
        <Row className="mb-2">
          {numPages > 1 && (
            <Col xs={{ span: 6, offset: 3 }}>
              <div style={{ display: "flex", flexDirection: "row", gap: "10px", justifyContent: "center" }}>
                Pages
                {range(numPages).map((p) => {
                  const textDecoration = p === startPage ? "underline" : "";
                  return (
                    <div key={p} style={{ cursor: "pointer" }} onClick={() => setStartPage(p)}>
                      <span style={{ textDecoration }}>{p}</span>
                    </div>
                  );
                })}
              </div>
            </Col>
          )}
        </Row>
      </>
    );
  };

  const disabled = !nfts || nfts.length === 0;

  return (
    <>
      <PageList />
      <Row
        style={{
          minHeight: "150px",
          backgroundColor: "rgba(0, 0, 0, 0.5)",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {!nfts && <span style={{ color: "#aaa", textAlign: "center" }}>Loading...</span>}
        {nfts && (
          <>
            {nfts.slice(startPage * pageSize, startPage * pageSize + pageSize).map((nft) => {
              const ctokenId = nft.getContractTokenId();

              const border = selection.has(ctokenId) ? "solid 2px #ffd454" : "solid 1px white";

              return (
                <Col md={pageSize === 12 ? 1 : 2} key={ctokenId} className="mb-3">
                  <OverlayTrigger overlay={<Tooltip>{nft.progress ? `Growth: ${nft.progress}%` : ""}</Tooltip>}>
                    <Card
                      style={{ width: "90px", padding: "10px", borderRadius: "5px", cursor: "pointer", border }}
                      onClick={() => toggleInSelection(ctokenId)}
                    >
                      {nft.progress && <ProgressBar style={{ height: "4px" }} now={nft.progress} />}
                      <Card.Img variant="top" src={nft.image} style={{ width: "75px", height: "75px" }} />
                      <span>
                        {nft.getNFTTypeShort()} #{nft.tokenId}
                      </span>
                    </Card>
                  </OverlayTrigger>
                </Col>
              );
            })}
            {nfts.length === 0 && (
              <span style={{ color: "#aaa", textAlign: "center" }}>
                {nothingMessage !== undefined && <div>{nothingMessage}</div>}
                {nothingMessage === undefined && <span>Nothing Here</span>}
              </span>
            )}
          </>
        )}
      </Row>
      <Row>
        <div style={{ display: "flex", justifyContent: "end", flexDirection: "row" }}>
          {nfts && (
            <div style={{ display: "flex", flexDirection: "row", gap: "10px" }}>
              <div style={{ textDecoration: "underline", color: "white", cursor: "pointer" }} onClick={selectAll}>
                Select All
              </div>
              (Selected: {selection.size} / {nfts.length})
            </div>
          )}
        </div>
      </Row>
      <Row>
        <div style={{ display: "flex", justifyContent: "end", padding: "10px", gap: "10px" }}>
          {secondButtonName && onSecondButtonClick && (
            <OverlayTrigger placement="top" overlay={<Tooltip>{secondButtonTooltip || ""}</Tooltip>}>
              <Button variant="info" onClick={() => onSecondButtonClick(selection)} disabled={disabled}>
                {secondButtonName}
              </Button>
            </OverlayTrigger>
          )}
          <OverlayTrigger placement="top" overlay={<Tooltip>{buttonTooltip || ""}</Tooltip>}>
            <Button variant="info" onClick={() => onButtonClick(selection)} disabled={disabled || selection.size === 0}>
              {buttonName}
            </Button>
          </OverlayTrigger>
        </div>
      </Row>
    </>
  );
};

type RPSProps = DappState & DappFunctions & {};
export function RPS(props: RPSProps) {
  const [walletCrystals, setWalletCrystals] = useState<Array<CrystalInfo>>();
  const [stakedNFTCards, setStakedNFTCards] = useState<Array<NFTCardInfo>>();

  const [crystalApprovalNeeded, setCrystalApprovalNeeded] = useState(false);

  const [refreshCounter, setRefreshCounter] = useState(0);

  const { readUserData } = props;
  useEffect(() => {
    // Update the user data, which contains the update-token-balances logic
    readUserData();
  }, [readUserData, refreshCounter]);

  // Get all NFTs in the wallet
  useEffect(() => {
    if (props.selectedAddress) {
      // Crystals
      fetch(`/crystalapi/wallet/${props.selectedAddress}`)
        .then((r) => r.json())
        .then((data) => {
          (async () => {
            const crystalDetails = await getMetadataForCrystalTokenIds(data);
            setWalletCrystals(crystalDetails);
          })();
        });
    }
  }, [props.selectedAddress, props.contracts, refreshCounter]);

  // Get all the staked NFTs, SPIRALBITS, Impish
  useEffect(() => {
    // Get staked wallet
    retryTillSucceed(async () => {
      if (props.contracts && props.selectedAddress) {
        const nftWallet = (await props.contracts.stakingv2.walletOfOwner(props.selectedAddress)) as Array<BigNumber>;

        // Split up into RWs, spirals and crystals
        const rwNFTIDs: Array<BigNumber> = [];
        const spiralsNFTIDs: Array<BigNumber> = [];
        const crystalNFTIDs: Array<BigNumber> = [];

        nftWallet.forEach((contractTokenId) => {
          const [tokenId, contractMultiplier] = NFTCardInfo.SplitFromContractTokenId(contractTokenId);
          switch (NFTCardInfo.NFTTypeForContractMultiplier(contractMultiplier.toNumber())) {
            case "RandomWalkNFT": {
              rwNFTIDs.push(tokenId);
              break;
            }
            case "Spiral": {
              spiralsNFTIDs.push(tokenId);
              break;
            }
            case "GrowingCrystal":
            case "Crystal": {
              crystalNFTIDs.push(tokenId);
              break;
            }
          }
        });

        // Get all the metadata for the spirals
        let stakedNFTCards = getNFTCardInfo(
          nftWallet,
          rwNFTIDs.map((t) => BigNumber.from(t)),
          await getSeedsForSpiralTokenIds(spiralsNFTIDs),
          await getMetadataForCrystalTokenIds(crystalNFTIDs)
        );

        // Split the NFT Cards into growing Crystals and everything else
        stakedNFTCards = stakedNFTCards.filter((c) => c.getNFTtype() !== "GrowingCrystal");

        setStakedNFTCards(stakedNFTCards);
      }
    });
  }, [props.selectedAddress, props.contracts, refreshCounter]);

  // Record all approvals needed
  useEffect(() => {
    retryTillSucceed(async () => {
      if (props.contracts && props.selectedAddress) {
        const crystalIsApproved = await props.contracts.crystal.isApprovedForAll(
          props.selectedAddress,
          props.contracts.stakingv2.address
        );

        setCrystalApprovalNeeded(!crystalIsApproved);
      }
    });
  }, [props.selectedAddress, props.contracts, refreshCounter]);

  const joinTeam = () => {};

  const walletNFTs = getNFTCardInfo([], [], [], walletCrystals);

  return (
    <>
      <Navigation {...props} />

      <div
        className="withSpiralBackgroundMultiSpiral"
        style={{ textAlign: "center", marginTop: "-50px", paddingTop: "100px" }}
      >
        <h1 className="mb-5">Chapter 4: Rock, Paper, Scissors</h1>

        {props.selectedAddress && (
          <>
            <Row>
              <Col md={6} style={{ border: "solid 1px white" }}>
                <h2
                  style={{
                    textAlign: "center",
                    backgroundColor: "rgba(0, 0, 0, 0.5)",
                    padding: "10px",
                    color: "#ffd454",
                  }}
                >
                  Fully Grown Crystals Available
                </h2>

                <CrystalListDisplay
                  title=""
                  buttonName={"Stake"}
                  pageSize={6}
                  nfts={walletNFTs}
                  onButtonClick={joinTeam}
                  refreshCounter={refreshCounter}
                  nothingMessage={
                    <div>
                      No Fully Grown Crystals.{" "}
                      <Link to="/Crystals" style={{ color: "#ffd454" }}>
                        Mint some to stake
                      </Link>
                    </div>
                  }
                />
              </Col>
            </Row>
          </>
        )}
        {!props.selectedAddress && (
          <div style={{ marginTop: "50px", marginBottom: "100px" }}>
            <div>
              Connect your Metamask wallet
              <br />
              to start playing the game
            </div>
            <a href="#faq" className="mb-5" style={{ color: "#ffc106" }}>
              What is Rock, Paper, Scissors?
            </a>
            <br />
            <Button className="connect mt-4" variant="warning" onClick={props.connectWallet}>
              Connect Wallet
            </Button>
          </div>
        )}
      </div>
    </>
  );
}
