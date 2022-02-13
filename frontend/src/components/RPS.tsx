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
import { CrystalInfo, DappFunctions, DappState, NFTCardInfo } from "../AppState";
import { formatkmb, range, retryTillSucceed } from "./utils";
import { BigNumber, ethers } from "ethers";
import { useEffect, useState } from "react";
import { Navigation } from "./Navigation";
import { cloneDeep } from "lodash";
import { Link } from "react-router-dom";
import {
  getMetadataForCrystalTokenIds,
  getNFTCardInfo,
  getRPSItemsFromStorage,
  MultiTxItem,
  RPSStorageItem,
  saveToLocalStorage,
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

enum Stages {
  Commit = 0,
  Reveal,
  Resolve,
  Claim,
  Finished,
  Shutdown,
}

enum Teams {
  Rock,
  Paper,
  Scissors,
}

type TeamInfo = {
  totalScore: BigNumber;
  winningSpiralBits: BigNumber;
  symmetriesLost: number;
  numCrystals: number;
};

type PlayerInfo = {
  revealed: boolean;
  claimed: boolean;
  team: number;
  numCrystals: number;
  smallestTeamBonus: BigNumber;
  smallestTeamSize: number;
  totalCrystalsInSmallestTeams: number;
};

type RPSProps = DappState & DappFunctions & {};
export function RPSScreen(props: RPSProps) {
  const [walletCrystals, setWalletCrystals] = useState<Array<CrystalInfo>>();
  const [stakedNFTCards, setStakedNFTCards] = useState<Array<NFTCardInfo>>();

  const [crystalApprovalNeeded, setCrystalApprovalNeeded] = useState(false);
  const [password, setPassword] = useState("");
  const [roundStartTime, setRoundStartTime] = useState(0);
  const [gameStage, setGameStage] = useState<Stages>();
  const [team, setTeam] = useState(Teams.Rock);
  const [revealedPlayerInfo, setRevealedPlayerInfo] = useState<PlayerInfo>();
  const [teamStats, setTeamStats] = useState<Array<TeamInfo>>([]);

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

  // Get all the staked NFTs
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

        const roundStart = await props.contracts.rps.roundStartTime();
        setRoundStartTime(roundStart);

        const now = (await props.contracts.provider.getBlock("latest")).timestamp;
        const daysSinceStart = Math.floor((now - roundStart) / (3600 * 24));
        if (daysSinceStart < 3) {
          setGameStage(Stages.Commit);
        } else if (daysSinceStart < 6) {
          setGameStage(Stages.Reveal);
        } else {
          setGameStage(Stages.Claim);
        }

        // Check if player has revealed his team, and if so, store everything.
        const playerInfo = await props.contracts.rps.players(props.selectedAddress);
        const smallestTeamBonusInfo = await props.contracts.rps.smallestTeamBonus();
        if (playerInfo) {
          setRevealedPlayerInfo({
            revealed: playerInfo.revealed,
            claimed: playerInfo.claimed,
            team: playerInfo.team,
            numCrystals: playerInfo.numCrystals,
            smallestTeamBonus: smallestTeamBonusInfo.bonusInSpiralBits,
            smallestTeamSize: smallestTeamBonusInfo.teamSize,
            totalCrystalsInSmallestTeams: smallestTeamBonusInfo.totalCrystalsInSmallestTeams,
          });
        } else {
          setRevealedPlayerInfo(undefined);
        }
      }
    });
  }, [props.selectedAddress, props.contracts, refreshCounter]);

  useEffect(() => {
    // Read the team stats
    fetch("/rpsapi/teamstats")
      .then((d) => d.json())
      .then((j) => {
        const teamStats: Array<TeamInfo> = [];
        for (let i = 0; i < 3; i++) {
          const item = j[i];
          teamStats.push({
            totalScore: BigNumber.from(item[0]),
            winningSpiralBits: BigNumber.from(item[1]),
            symmetriesLost: item[2],
            numCrystals: item[3],
          });
        }

        setTeamStats(teamStats);
      });
  }, [refreshCounter]);

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

  // Load any passwords from localstorage
  useEffect(() => {
    if (props.selectedAddress) {
      const items = getRPSItemsFromStorage(props.selectedAddress);
    }
  }, [props.selectedAddress, refreshCounter]);

  const getSalt = (pass: string): BigNumber => {
    const saltedPassword = `${pass}/${roundStartTime}`;
    return BigNumber.from(ethers.utils.keccak256(ethers.utils.toUtf8Bytes(saltedPassword)));
  };

  const claim = async () => {
    if (props.contracts && props.selectedAddress) {
      const txns: MultiTxItem[] = [];

      txns.push({
        title: `Claiming Winnings and Crystals`,
        tx: () => props.contracts?.rps.claim(),
      });

      const success = await props.executeMultiTx(txns);
      if (success) {
        props.showModal(
          `Claimed`,
          <div>
            All your Crystals and winnings have been claimed into your wallet
            <br />
            <br />
            Next round will start Monday.
          </div>,
          () => setRefreshCounter(refreshCounter + 1)
        );
      }
    }
  };

  const revealTeam = async () => {
    if (props.contracts && props.selectedAddress && revealDetails) {
      const txns: MultiTxItem[] = [];

      txns.push({
        title: `Reveal Team ${Teams[revealDetails?.team]}`,
        tx: () =>
          revealDetails ? props.contracts?.rps.revealCommitment(revealDetails.salt, revealDetails.team) : undefined,
      });

      const success = await props.executeMultiTx(txns);
      if (success) {
        props.showModal(
          `Revealed team ${Teams[revealDetails.team]}`,
          <div>
            You have revealed your team to be Team {Teams[revealDetails.team]}.
            <br />
            <br />
            You can now watch the team scores, and see if you win. Claim your winnings after 3 days.
          </div>,
          () => setRefreshCounter(refreshCounter + 1)
        );
      }
    }
  };

  const joinTeam = async (tokenIds: Set<number>) => {
    if (props.contracts && props.selectedAddress) {
      if (!password) {
        props.showModal("Bad Password", <div>Please enter a password</div>);
        return;
      }

      const txns: MultiTxItem[] = [];

      if (crystalApprovalNeeded) {
        txns.push({
          title: "Approving Crystals",
          tx: () => props.contracts?.crystal.setApprovalForAll(props.contracts?.rps.address, true),
        });
      }

      const salt = getSalt(password);
      const commitment = ethers.utils.solidityKeccak256(["uint256", "uint8"], [salt, team]);
      {
        const walletCrystalIDs = Array.from(tokenIds)
          .map((n) => (n >= 4000000 ? n - 4000000 : n))
          .filter((tokenId) => walletCrystals?.find((wc) => wc.tokenId.toNumber() === tokenId))
          .map((n) => BigNumber.from(n));

        if (walletCrystalIDs.length > 0) {
          console.log(JSON.stringify(walletCrystalIDs));
          txns.push({
            title: `Wallet: Secretly Joining Team ${Teams[team]}`,
            tx: () =>
              props.selectedAddress
                ? props.contracts?.rps.commit(commitment, props.selectedAddress, walletCrystalIDs)
                : undefined,
          });
        }
      }

      {
        const stakedCrystalIDs = Array.from(tokenIds)
          .map((n) => (n >= 4000000 ? n - 4000000 : n))
          .filter((tokenId) => stakedNFTCards?.find((snft) => snft.tokenId === tokenId))
          .map((n) => BigNumber.from(n));
        if (stakedCrystalIDs.length > 0) {
          console.log(JSON.stringify(stakedCrystalIDs));
          txns.push({
            title: `Staked: Secretly Joining Team ${Teams[team]}`,
            tx: () =>
              props.selectedAddress ? props.contracts?.stakingv2.rpsCommit(commitment, stakedCrystalIDs) : undefined,
          });
        }
      }
      const success = await props.executeMultiTx(txns);
      if (success) {
        console.log(`Success. "${password}" - ${salt.toHexString()}`);

        // Also store the password in localstorage
        saveToLocalStorage(props.selectedAddress, password, team, salt, roundStartTime);

        props.showModal(
          `Joined team ${Teams[team]}`,
          <div>
            You have joined team {Teams[team]} with password "{password}".
            <br />
            <br />
            Remember to come back in 3 days and reveal your team, and see if you won!
          </div>,
          () => setRefreshCounter(refreshCounter + 1)
        );
      }
    }
  };

  const allCrystals = getNFTCardInfo([], [], [], walletCrystals).concat(stakedNFTCards || []);

  let revealDetails: RPSStorageItem | undefined;
  if (props.selectedAddress) {
    revealDetails = getRPSItemsFromStorage(props.selectedAddress).find((i) => i.startTime === roundStartTime);
  }

  return (
    <>
      <Navigation {...props} />

      <div
        className="withSpiralBackgroundMultiSpiral"
        style={{ textAlign: "center", marginTop: "-50px", paddingTop: "100px" }}
      >
        <h1 className="mb-5">Chapter 4: Rock, Paper, Scissors</h1>

        <h5>Current Stage {gameStage} </h5>

        {props.selectedAddress && (
          <>
            {gameStage === Stages.Commit && (
              <Row>
                <Col md={12} style={{ border: "solid 1px white" }}>
                  <h2
                    style={{
                      backgroundColor: "rgba(0, 0, 0, 0.5)",
                      padding: "10px",
                      color: "#ffd454",
                    }}
                  >
                    Phase 1: Commit to a Team
                  </h2>

                  {revealedPlayerInfo && revealedPlayerInfo.numCrystals > 0 && (
                    <div className="mb-4" style={{ display: "flex", flexDirection: "column" }}>
                      <div style={{ textAlign: "center" }}>
                        You have already joined team {Teams[revealDetails?.team || 0]}. Please wait for 3 days before
                        you can reveal your team and see how you did.
                      </div>
                    </div>
                  )}

                  {(revealedPlayerInfo === undefined || revealedPlayerInfo.numCrystals === 0) && (
                    <div style={{ display: "flex", flexDirection: "column" }}>
                      <div style={{ textAlign: "left", marginLeft: "15%" }}>
                        <div>Step 1: Pick a password</div>
                        <InputGroup style={{ width: "600px" }}>
                          <InputGroup.Text>Commitment Password</InputGroup.Text>
                          <FormControl
                            type="text"
                            value={password}
                            onChange={(e) => setPassword(e.currentTarget.value)}
                          />
                        </InputGroup>
                        <div>
                          Type in a password to hide your commitment. You will need this password to reveal the team you
                          joined in 3 days.
                        </div>
                      </div>

                      <div className="mt-4" style={{ textAlign: "left", marginLeft: "15%" }}>
                        <div>Step 2: Pick a team</div>
                        <div>
                          <FloatingLabel label="Join Team" style={{ color: "black", width: "200px" }}>
                            <Form.Select value={team} onChange={(e) => setTeam(parseInt(e.currentTarget.value))}>
                              <option value={Teams.Rock}>Rock</option>
                              <option value={Teams.Paper}>Paper</option>
                              <option value={Teams.Scissors}>Scissors</option>
                            </Form.Select>
                          </FloatingLabel>
                        </div>
                      </div>

                      <div className="mt-4" style={{ textAlign: "left", marginLeft: "15%" }}>
                        <div>Step 3: Select fully grown crystals</div>
                      </div>
                      <CrystalListDisplay
                        title=""
                        buttonName={`Join team ${Teams[team]}`}
                        pageSize={6}
                        nfts={allCrystals}
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
                    </div>
                  )}
                </Col>
              </Row>
            )}

            {gameStage === Stages.Reveal && (
              <Row>
                {revealedPlayerInfo && !revealedPlayerInfo.revealed && (
                  <Col md={12} style={{ border: "solid 1px white" }}>
                    <h2
                      style={{
                        backgroundColor: "rgba(0, 0, 0, 0.5)",
                        padding: "10px",
                        color: "#ffd454",
                      }}
                    >
                      Phase 2: Reveal your Team
                    </h2>

                    <div style={{ display: "flex", flexDirection: "column" }}>
                      <div style={{ textAlign: "left", marginLeft: "15%" }}>
                        <div>Step 1: Type your password</div>
                        <InputGroup style={{ width: "600px" }}>
                          <InputGroup.Text>Commitment Password</InputGroup.Text>
                          <FormControl
                            type="text"
                            value={revealDetails?.password}
                            onChange={(e) => setPassword(e.currentTarget.value)}
                          />
                        </InputGroup>
                      </div>

                      <div className="mt-4" style={{ textAlign: "left", marginLeft: "15%" }}>
                        <div>Step 2: Reveal your team</div>
                        <FloatingLabel label="Joined Team" style={{ color: "black", width: "200px" }}>
                          <Form.Select
                            value={revealDetails?.team}
                            onChange={(e) => setTeam(parseInt(e.currentTarget.value))}
                          >
                            <option value={Teams.Rock}>Rock</option>
                            <option value={Teams.Paper}>Paper</option>
                            <option value={Teams.Scissors}>Scissors</option>
                          </Form.Select>
                        </FloatingLabel>
                      </div>
                    </div>

                    <div className="mt-4 mb-4" style={{ textAlign: "left", marginLeft: "15%" }}>
                      <Button variant="warning" onClick={revealTeam}>
                        Reveal
                      </Button>
                    </div>
                  </Col>
                )}
              </Row>
            )}

            {(gameStage === Stages.Reveal || gameStage === Stages.Claim) && (
              <Row>
                <h2
                  style={{
                    backgroundColor: "rgba(0, 0, 0, 0.5)",
                    padding: "10px",
                    color: "#ffd454",
                  }}
                >
                  Current Team Stats
                </h2>
                {[0, 1, 2].map((teamNum) => {
                  const teamStat = teamStats[teamNum];
                  const nextTeamStat = teamStats[(teamNum + 1) % 3];
                  const prevTeamStat = teamStats[(teamNum + 2) % 3];

                  const smallestTeamSize = Math.min(
                    teamStat.numCrystals,
                    prevTeamStat.numCrystals,
                    nextTeamStat.numCrystals
                  );

                  let winningString;
                  if (gameStage === Stages.Reveal) {
                    winningString = teamStat.totalScore.gt(nextTeamStat.totalScore)
                      ? `Currently winning`
                      : `Currently not winning`;
                  } else {
                    winningString = teamStat.winningSpiralBits.gt(0)
                      ? `Won ${formatkmb(teamStat.winningSpiralBits)} SPIRALBITS`
                      : "Lost";
                  }

                  let losingString;
                  if (gameStage === Stages.Reveal) {
                    losingString = prevTeamStat.totalScore.gt(teamStat.totalScore)
                      ? `Currently losing`
                      : `Currently not losing`;
                  } else {
                    losingString =
                      teamStat.symmetriesLost > 0 ? `Lost ${teamStat.symmetriesLost} Symmetry` : `No Symmetries Lost`;
                  }

                  if (teamStat) {
                    return (
                      <Col key={teamNum} md={4}>
                        <h3>Team {Teams[teamNum]}</h3>
                        <Table style={{ color: "white", fontSize: "0.9rem", textAlign: "right" }}>
                          <tbody>
                            <tr>
                              <td style={{ textAlign: "left" }}>Score</td>
                              <td>{formatkmb(teamStat.totalScore)}</td>
                            </tr>
                            <tr>
                              <td style={{ textAlign: "left" }}>Number of Crystals</td>
                              <td>{teamStat.numCrystals}</td>
                            </tr>
                            <tr>
                              <td style={{ textAlign: "left" }}>vs Team {Teams[(teamNum + 1) % 3]}</td>
                              <td>{winningString}</td>
                            </tr>
                            <tr>
                              <td style={{ textAlign: "left" }}>vs Team {Teams[(teamNum + 2) % 3]}</td>
                              <td>{losingString}</td>
                            </tr>
                            <tr>
                              <td style={{ textAlign: "left" }}>Smallest Team Bonus</td>
                              <td>{smallestTeamSize === teamStat.numCrystals ? "Yes" : "No"}</td>
                            </tr>
                          </tbody>
                        </Table>
                      </Col>
                    );
                  } else {
                    return <></>;
                  }
                })}
              </Row>
            )}

            {gameStage === Stages.Claim && (
              <Row>
                {revealedPlayerInfo && !revealedPlayerInfo.claimed && (
                  <Col md={12} style={{ border: "solid 1px white" }}>
                    <h2
                      style={{
                        backgroundColor: "rgba(0, 0, 0, 0.5)",
                        padding: "10px",
                        color: "#ffd454",
                      }}
                    >
                      Phase 3: Claim
                    </h2>
                    <div style={{ display: "flex", flexDirection: "column" }}>
                      <div style={{ textAlign: "left", marginLeft: "15%" }}>
                        {(() => {
                          const teamNum = revealedPlayerInfo.team;
                          const spiralBitsWon = teamStats[teamNum].winningSpiralBits
                            .mul(revealedPlayerInfo.numCrystals)
                            .div(teamStats[teamNum].numCrystals);
                          const lostSym = teamStats[teamNum].symmetriesLost;

                          let smallestTeamBonus = BigNumber.from(0);
                          if (teamStats[teamNum].numCrystals === revealedPlayerInfo.smallestTeamSize) {
                            smallestTeamBonus = revealedPlayerInfo.smallestTeamBonus
                              .mul(revealedPlayerInfo.numCrystals)
                              .div(revealedPlayerInfo.totalCrystalsInSmallestTeams);
                          }

                          return (
                            <>
                              <div>Team: Team {Teams[teamNum]}</div>
                              <div>Number of Crystals: {revealedPlayerInfo.numCrystals}</div>
                              <div>Won: {formatkmb(spiralBitsWon)} SPIRALBITS</div>
                              <div>Lost: {lostSym} Symmetries per Crystal</div>
                              <div>Smallest Team Bonus: {formatkmb(smallestTeamBonus)}</div>
                            </>
                          );
                        })()}
                      </div>
                    </div>
                    <div className="mb-4 mt-2" style={{ textAlign: "left", marginLeft: "15%" }}>
                      <Button variant="warning" onClick={claim}>
                        Claim Crystals and Prizes
                      </Button>
                    </div>
                  </Col>
                )}
              </Row>
            )}
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
