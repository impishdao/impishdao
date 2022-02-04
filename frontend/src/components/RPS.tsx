/* eslint-disable jsx-a11y/anchor-is-valid */
/* eslint-disable jsx-a11y/anchor-has-content */
import {
  Button,
  Card,
  Col,
  FloatingLabel,
  Form,
  FormControl,
  InputGroup,
  OverlayTrigger,
  ProgressBar,
  Row,
  Table,
  Tooltip,
} from "react-bootstrap";
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
export function RPSScreen(props: RPSProps) {
  const [walletCrystals, setWalletCrystals] = useState<Array<CrystalInfo>>();
  const [stakedNFTCards, setStakedNFTCards] = useState<Array<NFTCardInfo>>();

  const [crystalApprovalNeeded, setCrystalApprovalNeeded] = useState(false);
  const [password, setPassword] = useState("");
  const [roundStartTime, setRoundStartTime] = useState(0);
  const [team, setTeam] = useState("Rock");

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
            let crystalDetails = await getMetadataForCrystalTokenIds(data);
            crystalDetails = crystalDetails.filter((card) => card.size === 100);
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
        let stakedNFTCards = getNFTCardInfo(nftWallet, [], [], await getMetadataForCrystalTokenIds(crystalNFTIDs));

        // Split the NFT Cards into growing Crystals and everything else
        stakedNFTCards = stakedNFTCards.filter((c) => c.getNFTtype() === "Crystal");
        setStakedNFTCards(stakedNFTCards);

        setRoundStartTime(await props.contracts.rps.roundStartTime());
      }
    });
  }, [props.selectedAddress, props.contracts, refreshCounter]);

  // Record all approvals needed
  useEffect(() => {
    retryTillSucceed(async () => {
      if (props.contracts && props.selectedAddress) {
        const crystalIsApproved = await props.contracts.crystal.isApprovedForAll(
          props.selectedAddress,
          props.contracts.rps.address
        );

        setCrystalApprovalNeeded(!crystalIsApproved);
      }
    });
  }, [props.selectedAddress, props.contracts, refreshCounter]);

  const getSalt = (pass: string): BigNumber => {
    const saltedPassword = `${pass}/${roundStartTime}`;
    return BigNumber.from(ethers.utils.keccak256(ethers.utils.toUtf8Bytes(saltedPassword))).shr(128);
  };

  const joinTeam = async (tokenIds: Set<number>) => {
    if (props.contracts && props.selectedAddress) {
      const txns: MultiTxItem[] = [];

      if (crystalApprovalNeeded) {
        txns.push({
          title: "Approving Crystals",
          tx: () => props.contracts?.crystal.setApprovalForAll(props.contracts?.rps.address, true),
        });
      }

      const salt = getSalt(password);
      const commitment = ethers.utils.solidityKeccak256(["uint128", "uint8"], [salt, 1]);
      const crystalIDs = Array.from(tokenIds)
        .map((n) => (n >= 4000000 ? n - 4000000 : n))
        .map((n) => BigNumber.from(n));
      txns.push({
        title: `Joining ${team} secretly`,
        tx: () =>
          props.selectedAddress
            ? props.contracts?.rps.commit(commitment, props.selectedAddress, crystalIDs)
            : undefined,
      });

      const success = await props.executeMultiTx(txns);
      if (success) {
        console.log(`Success. "${password}" - ${salt.toHexString()}`);

        props.showModal(
          `Joined team ${team}`,
          <div>
            You have joined team {team} with password "{password}".
            <br />
            <br />
            Remember to come back in 3 days and reveal your team, and see if you won!
          </div>,
          () => setRefreshCounter(refreshCounter + 1)
        );
      }
    }
  };

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
              <Col md={12} style={{ border: "solid 1px white" }}>
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

                <div style={{ display: "flex", flexDirection: "row", justifyContent: "space-between" }}>
                  <div style={{ width: "50%" }}>
                    <InputGroup style={{ width: "600px" }}>
                      <InputGroup.Text>Commitment Password</InputGroup.Text>
                      <FormControl type="text" value={password} onChange={(e) => setPassword(e.currentTarget.value)} />
                    </InputGroup>
                    <div className="mb-3" style={{ textAlign: "right" }}>
                      Type in a password to hide your commitment. You will need this password to reveal the team you
                      joined in 3 days.
                    </div>
                  </div>

                  <div>
                    <FloatingLabel label="Join Team" style={{ color: "black", width: "200px" }}>
                      <Form.Select value={team} onChange={(e) => setTeam(e.currentTarget.value)}>
                        <option value="Rock">Rock</option>
                        <option value="Paper">Paper</option>
                        <option value="Scissors">Scissors</option>
                      </Form.Select>
                    </FloatingLabel>
                  </div>
                </div>
                <CrystalListDisplay
                  title=""
                  buttonName={`Join team ${team}`}
                  pageSize={6}
                  nfts={walletNFTs}
                  onButtonClick={joinTeam}
                  refreshCounter={refreshCounter}
                  nothingMessage={
                    <div>
                      No Fully Grown Crystals.{" "}
                      <Link to="/crystals" style={{ color: "#ffd454" }}>
                        Mint some to play
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
