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

type StakingPageDisplayProps = {
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
const StakingPageDisplay = ({
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
}: StakingPageDisplayProps) => {
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

type StakingApprovedForV2 = {
  spiralbits: boolean;
  impdao: boolean;
  randomwalknft: boolean;
  spiral: boolean;
  crystal: boolean;
};

type StakingYield = {
  spiralBitsPerM: BigNumber;
  impish: BigNumber;
};

type SpiralStakingProps = DappState & DappFunctions & {};

export function SpiralStaking(props: SpiralStakingProps) {
  const [walletRWNFTs, setWalletRWNFTs] = useState<Array<BigNumber>>();
  const [walletSpirals, setWalletSpirals] = useState<Array<SpiralDetail>>();
  const [walletCrystals, setWalletCrystals] = useState<Array<CrystalInfo>>();

  const [stakedNFTCards, setStakedNFTCards] = useState<Array<NFTCardInfo>>();
  const [growingCrystalNFTCards, setGrowingCrystalNFTCards] = useState<Array<NFTCardInfo>>();
  const [v1StakedNFTs, setV1StakedNFTs] = useState<Array<NFTCardInfo>>();
  const [v1RewardsPending, setV1RewardsPending] = useState<BigNumber>(BigNumber.from(0));

  const [stakedSpiralBits, setStakedSpiralBits] = useState<BigNumber>();
  const [stakedImpish, setStakedImpish] = useState<BigNumber>();

  const [spiralBitsPendingReward, setSpiralBitsPendingReward] = useState<BigNumber>();
  const [spiralBitsLeftAfterGrowing, setSpiralBitsLeftAfterGrowing] = useState<BigNumber>();

  const [spiralBitsToStake, setSpiralBitsToStake] = useState("");
  const [impishToStake, setImpishToStake] = useState("");

  const [approvedForStakingv2, setApprovedForStakingv2] = useState<StakingApprovedForV2>();

  const [stakingYield, setStakingYield] = useState<StakingYield>();

  const [refreshCounter, setRefreshCounter] = useState(0);

  const { readUserData } = props;
  useEffect(() => {
    // Update the user data, which contains the update-token-balances logic
    readUserData();
  }, [readUserData, refreshCounter]);

  // Get all NFTs in the wallet
  useEffect(() => {
    if (props.selectedAddress) {
      // RandomWalkNFTs
      retryTillSucceed(async () => {
        if (props.selectedAddress && props.contracts) {
          const walletTokenIds = (await props.contracts.rwnft.walletOfOwner(props.selectedAddress)) as Array<BigNumber>;
          setWalletRWNFTs(walletTokenIds);
        }
      });

      // Spirals
      fetch(`/spiralapi/wallet/${props.selectedAddress}`)
        .then((r) => r.json())
        .then(async (data) => {
          setWalletSpirals(await getSeedsForSpiralTokenIds(data));
        });

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

  // Get the v1 staked Spirals and RWNFTs
  useEffect(() => {
    retryTillSucceed(async () => {
      if (props.selectedAddress && props.contracts) {
        const stakedSpiralIds = (await props.contracts.spiralstaking.walletOfOwner(
          props.selectedAddress
        )) as Array<BigNumber>;
        const spirals = await getSeedsForSpiralTokenIds(stakedSpiralIds);

        const stakedRwNFTIds = (await props.contracts.rwnftstaking.walletOfOwner(
          props.selectedAddress
        )) as Array<BigNumber>;

        setV1StakedNFTs(getNFTCardInfo([], stakedRwNFTIds, spirals));

        // If there are any staked in V1, calculate pending rewards
        let pendingV1Rewards = BigNumber.from(0);
        if (stakedRwNFTIds.length > 0) {
          const rwPending = await props.contracts.rwnftstaking.claimsPendingTotal(props.selectedAddress);
          const bonus = await props.contracts.rwnftstaking.currentBonusInBips();
          pendingV1Rewards = pendingV1Rewards.add(rwPending).add(rwPending.mul(bonus).div(10000));
        }

        if (spirals.length > 0) {
          const spiralPending = await props.contracts.spiralstaking.claimsPendingTotal(props.selectedAddress);
          const bonus = await props.contracts.spiralstaking.currentBonusInBips();
          pendingV1Rewards = pendingV1Rewards.add(spiralPending).add(spiralPending.mul(bonus).div(10000));
        }

        setV1RewardsPending(pendingV1Rewards);
      }
    });
  }, [props.selectedAddress, props.contracts, refreshCounter]);

  // Get all the staked NFTs, SPIRALBITS, Impish
  useEffect(() => {
    // Get staked wallet
    retryTillSucceed(async () => {
      if (props.contracts) {
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

        // Get pending rewards
        let pendingRewards = await props.contracts.stakingv2.pendingRewards(props.selectedAddress);
        console.log(`Pending Rewards ${ethers.utils.formatEther(pendingRewards)}`);
        setSpiralBitsPendingReward(pendingRewards);

        // Split the NFT Cards into growing Crystals and everything else
        let growingCrystals = stakedNFTCards.filter((c) => c.getNFTtype() === "GrowingCrystal");
        stakedNFTCards = stakedNFTCards.filter((c) => c.getNFTtype() !== "GrowingCrystal");

        // allocate the pending rewards to the growing crystals to make them grow.
        growingCrystals = growingCrystals.map((gc) => {
          const crystalInfo = gc.metadata as CrystalInfo;
          const crystalCapacity = Eth1k.mul(crystalInfo.sym).mul(100 - crystalInfo.size);

          if (pendingRewards.gt(crystalCapacity)) {
            crystalInfo.size = 100;

            gc.progress = 100;
            gc.image = getCrystalImage(crystalInfo);
            pendingRewards = pendingRewards.sub(crystalCapacity);
          } else if (pendingRewards.gt(0)) {
            crystalInfo.size += Math.floor(pendingRewards.div(Eth1k.mul(crystalInfo.sym)).toNumber());

            gc.progress = crystalInfo.size;
            gc.image = getCrystalImage(crystalInfo);
            pendingRewards = BigNumber.from(0);
          } else {
            gc.progress = crystalInfo.size;
          }

          return gc;
        });

        setSpiralBitsLeftAfterGrowing(pendingRewards);
        setGrowingCrystalNFTCards(growingCrystals);
        setStakedNFTCards(stakedNFTCards);

        // Get staked Spiralbits and Impish
        const stakedTokens = await props.contracts.stakingv2.stakedNFTsAndTokens(props.selectedAddress);
        setStakedSpiralBits(BigNumber.from(stakedTokens["spiralBitsStaked"]));
        setStakedImpish(BigNumber.from(stakedTokens["impishStaked"]));
      }
    });
  }, [props.selectedAddress, props.contracts, refreshCounter]);

  // Calculate APR
  useEffect(() => {
    retryTillSucceed(async () => {
      if (props.selectedAddress && props.contracts) {
        const totalSpiralBitsStaked = await props.contracts.spiralbits.balanceOf(props.contracts.stakingv2.address);
        const totalImpishStaked = await props.contracts.impdao.balanceOf(props.contracts.stakingv2.address);

        setStakingYield({
          spiralBitsPerM: Eth1M.mul(ethers.utils.parseEther("4"))
            .mul(3600 * 24)
            .div(totalSpiralBitsStaked.add(Eth1M)),
          impish: Eth1.mul(Eth1)
            .mul(3600 * 24)
            .div(totalImpishStaked.add(Eth1)),
        });
      }
    });
  }, [props.selectedAddress, props.contracts, refreshCounter]);

  // Record all approvals needed
  useEffect(() => {
    retryTillSucceed(async () => {
      if (props.contracts && props.selectedAddress) {
        const spiralbits = (
          await props.contracts.spiralbits.allowance(props.selectedAddress, props.contracts.stakingv2.address)
        ).gt(0);

        const impdao = (
          await props.contracts.impdao.allowance(props.selectedAddress, props.contracts.stakingv2.address)
        ).gt(0);

        const randomwalknft = await props.contracts.rwnft.isApprovedForAll(
          props.selectedAddress,
          props.contracts.stakingv2.address
        );
        const spiral = await props.contracts.impspiral.isApprovedForAll(
          props.selectedAddress,
          props.contracts.stakingv2.address
        );
        const crystal = await props.contracts.crystal.isApprovedForAll(
          props.selectedAddress,
          props.contracts.stakingv2.address
        );

        setApprovedForStakingv2({ spiralbits, impdao, randomwalknft, spiral, crystal });
      }
    });
  }, [props.selectedAddress, props.contracts, refreshCounter]);

  const stakeV2 = async (contractTokenIdsSet: Set<number>) => {
    if (props.contracts && props.selectedAddress && approvedForStakingv2) {
      // Check if any RandomWalks are present
      const contractTokenIds = Array.from(contractTokenIdsSet);

      const randomWalksPresent =
        contractTokenIds.filter((t) => NFTCardInfo.NFTTypeFromContractTokenId(t) === "RandomWalkNFT").length > 0;
      const spiralsPresent =
        contractTokenIds.filter((t) => NFTCardInfo.NFTTypeFromContractTokenId(t) === "Spiral").length > 0;
      const crystalsPresent =
        contractTokenIds.filter(
          (t) =>
            NFTCardInfo.NFTTypeFromContractTokenId(t) === "GrowingCrystal" ||
            NFTCardInfo.NFTTypeFromContractTokenId(t) === "Crystal"
        ).length > 0;

      const txns: MultiTxItem[] = [];
      if (randomWalksPresent && !approvedForStakingv2.randomwalknft) {
        txns.push({
          title: "Approving RandomWalkNFT",
          tx: () => props.contracts?.rwnft.setApprovalForAll(props.contracts?.stakingv2.address, true),
        });
      }

      if (spiralsPresent && !approvedForStakingv2.spiral) {
        txns.push({
          title: "Approving Spirals",
          tx: () => props.contracts?.impspiral.setApprovalForAll(props.contracts?.stakingv2.address, true),
        });
      }

      if (crystalsPresent && !approvedForStakingv2.crystal) {
        txns.push({
          title: "Approving Crystals",
          tx: () => props.contracts?.crystal.setApprovalForAll(props.contracts?.stakingv2.address, true),
        });
      }

      txns.push({
        title: "Staking NFTs",
        tx: () => props.contracts?.stakingv2.stakeNFTsForOwner(contractTokenIds, props.selectedAddress),
      });

      const success = await props.executeMultiTx(txns);
      if (success) {
        console.log("Success");
        setRefreshCounter(refreshCounter + 1);
      }
    }
  };

  const unstakeV2 = async (contractTokenIdsSet: Set<number>) => {
    if (props.contracts && props.selectedAddress) {
      const contractTokenIds = Array.from(contractTokenIdsSet);

      console.log("Unstaking");
      contractTokenIds?.forEach((t) => console.log(t));

      await props.waitForTxConfirmation(props.contracts.stakingv2.unstakeNFTs(contractTokenIds, false), "Unstaking");
      setRefreshCounter(refreshCounter + 1);
    }
  };

  const harvest = async (contractTokenIdsSet: Set<number>) => {
    if (props.contracts && props.selectedAddress) {
      const harvestable = growingCrystalNFTCards
        ?.filter((nft) => nft.progress === 100)
        .map((nft) => BigNumber.from(nft.getContractTokenId()));

      if (harvestable && harvestable.length > 0) {
        await props.waitForTxConfirmation(props.contracts.stakingv2.harvestCrystals(harvestable, false));
        setRefreshCounter(refreshCounter + 1);
      } else {
        props.showModal("Nothing to harvest", <div>There are no fully grown crystals to harvest</div>);
      }
    }
  };

  const withdrawRewards = async () => {
    if (props.contracts && props.selectedAddress) {
      const harvestable = growingCrystalNFTCards
        ?.filter((nft) => nft.progress === 100)
        .map((nft) => BigNumber.from(nft.getContractTokenId()));

      await props.waitForTxConfirmation(props.contracts.stakingv2.harvestCrystals(harvestable, true));
      setRefreshCounter(refreshCounter + 1);
    }
  };

  const stakeSpiralBits = async () => {
    if (props.contracts && props.selectedAddress && approvedForStakingv2) {
      const txns: MultiTxItem[] = [];

      if (!approvedForStakingv2.spiralbits) {
        txns.push({
          tx: () => props.contracts?.spiralbits.approve(props.contracts?.stakingv2.address, Eth2B),
          title: "Approving",
        });
      }

      const spiralBits18Dec = ethers.utils.parseEther(spiralBitsToStake);
      txns.push({ tx: () => props.contracts?.stakingv2.stakeSpiralBits(spiralBits18Dec), title: "Staking SpiralBits" });

      await props.executeMultiTx(txns);

      setSpiralBitsToStake("");
      setRefreshCounter(refreshCounter + 1);
    }
  };

  const unstakeSpiralBits = async () => {
    if (props.contracts && props.selectedAddress) {
      await props.waitForTxConfirmation(props.contracts.stakingv2.unstakeSpiralBits(false), "Unstaking SpiralBits");

      setRefreshCounter(refreshCounter + 1);
    }
  };

  const stakeImpish = async () => {
    if (props.contracts && props.selectedAddress && approvedForStakingv2) {
      const txns: MultiTxItem[] = [];

      if (!approvedForStakingv2.impdao) {
        txns.push({
          tx: () => props.contracts?.impdao.approve(props.contracts?.stakingv2.address, Eth2B),
          title: "Approving",
        });
      }

      const impish18Dec = ethers.utils.parseEther(impishToStake);
      txns.push({ tx: () => props.contracts?.stakingv2.stakeImpish(impish18Dec), title: "Staking Impish" });

      await props.executeMultiTx(txns);

      setImpishToStake("");
      setRefreshCounter(refreshCounter + 1);
    }
  };

  const unstakeImpish = async () => {
    if (props.contracts && props.selectedAddress) {
      await props.waitForTxConfirmation(props.contracts.stakingv2.unstakeImpish(false), "Unstaking Impish");

      setRefreshCounter(refreshCounter + 1);
    }
  };

  const unstakeV1 = async () => {
    if (props.contracts && props.selectedAddress && v1StakedNFTs) {
      const beforeSpiralBits = props.spiralBitsBalance;

      const txns: MultiTxItem[] = [];

      const rwTokenIds = v1StakedNFTs.filter((nft) => nft.getNFTtype() === "RandomWalkNFT").map((nft) => nft.tokenId);
      if (rwTokenIds.length > 0) {
        txns.push({
          title: "Unstaking All RandomWalkNFTs",
          tx: () => props.contracts?.rwnftstaking.unstakeNFTs(rwTokenIds, true),
        });
      }

      const spiralTokenIds = v1StakedNFTs.filter((nft) => nft.getNFTtype() === "Spiral").map((nft) => nft.tokenId);
      if (spiralTokenIds.length > 0) {
        txns.push({
          title: "Unstaking All Spirals",
          tx: () => props.contracts?.spiralstaking.unstakeNFTs(spiralTokenIds, true),
        });
      }

      const success = await props.executeMultiTx(txns);
      if (success) {
        setRefreshCounter(refreshCounter + 1);

        const afterSpiralBits = await props.contracts.spiralbits.balanceOf(props.selectedAddress);
        if (afterSpiralBits.gt(beforeSpiralBits)) {
          props.showModal(
            "Claimed SPIRALBITS",
            <div>
              You successfully claimed {formatkmb(afterSpiralBits.sub(beforeSpiralBits))} SPIRALBITS into your wallet.
            </div>
          );
        }
      }
    }
  };

  const walletNFTs = getNFTCardInfo([], walletRWNFTs, walletSpirals, walletCrystals);

  return (
    <>
      <Navigation {...props} />

      <div
        className="withSpiralBackgroundMultiSpiral"
        style={{ textAlign: "center", marginTop: "-50px", paddingTop: "100px" }}
      >
        <h1 className="mb-5">Chapter 2: Staking</h1>

        {props.selectedAddress && (
          <>
            <Row>
              <Col
                md={6}
                style={{ paddingBottom: "2%", paddingLeft: "10%", paddingRight: "10%", border: "solid 1px white" }}
              >
                <h2
                  style={{
                    textAlign: "center",
                    backgroundColor: "rgba(0, 0, 0, 0.5)",
                    padding: "10px",
                    color: "#ffd454",
                  }}
                >
                  Stake SPIRALBITS
                </h2>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <div>Wallet</div>
                  <div
                    style={{ textDecoration: "underline", cursor: "pointer" }}
                    onClick={() => setSpiralBitsToStake(ethers.utils.formatEther(props.spiralBitsBalance))}
                  >
                    {formatkmb(props.spiralBitsBalance)} SPIRALBITS
                  </div>
                </div>

                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <div>Yield</div>
                  <div>{formatkmb(stakingYield?.spiralBitsPerM)} per 1M SPIRALBITS per Day</div>
                </div>
                <div className="mt-4 mb-1" style={{ display: "flex", justifyContent: "end" }}>
                  <Form.Group
                    className="mb-3"
                    style={{ display: "flex", width: "100%", alignItems: "center", gap: "5px" }}
                  >
                    <Form.Control
                      type="number"
                      style={{ textAlign: "right" }}
                      step={1}
                      placeholder="SPIRALBITS to Stake"
                      value={spiralBitsToStake}
                      onChange={(e) => setSpiralBitsToStake(e.currentTarget.value)}
                    />
                    <Button variant="info" onClick={stakeSpiralBits}>
                      Stake
                    </Button>
                  </Form.Group>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <div>Staked</div>
                  <div>{formatkmb(stakedSpiralBits)} SPIRALBITS</div>
                </div>
                <div style={{ display: "flex", justifyContent: "end" }}>
                  <Button variant="info" onClick={unstakeSpiralBits}>
                    Unstake All
                  </Button>
                </div>
              </Col>
              <Col
                md={6}
                style={{ paddingBottom: "2%", paddingLeft: "10%", paddingRight: "10%", border: "solid 1px white" }}
              >
                <h2
                  style={{
                    textAlign: "center",
                    backgroundColor: "rgba(0, 0, 0, 0.5)",
                    padding: "10px",
                    color: "#ffd454",
                  }}
                >
                  Stake IMPISH
                </h2>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <div>Wallet</div>
                  <div
                    style={{ textDecoration: "underline", cursor: "pointer" }}
                    onClick={() => setImpishToStake(ethers.utils.formatEther(props.impishTokenBalance))}
                  >
                    {formatkmb(props.impishTokenBalance)} IMPISH
                  </div>
                </div>

                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <div>Yield</div>
                  <div>{formatkmb(stakingYield?.impish)} per IMPISH per Day </div>
                </div>
                <div className="mt-4 mb-1" style={{ display: "flex", justifyContent: "end" }}>
                  <Form.Group
                    className="mb-3"
                    style={{ display: "flex", width: "100%", alignItems: "center", gap: "5px" }}
                  >
                    <Form.Control
                      type="number"
                      style={{ textAlign: "right" }}
                      step={1}
                      placeholder="IMPISH to Stake"
                      value={impishToStake}
                      onChange={(e) => setImpishToStake(e.currentTarget.value)}
                    />
                    <Button variant="info" onClick={stakeImpish}>
                      Stake
                    </Button>
                  </Form.Group>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <div>Staked</div>
                  <div>{formatkmb(stakedImpish)} IMPISH</div>
                </div>
                <div style={{ display: "flex", justifyContent: "end" }}>
                  <Button variant="info" onClick={unstakeImpish}>
                    Unstake All
                  </Button>
                </div>
              </Col>
            </Row>
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
                  NFTs in Wallet
                </h2>

                <StakingPageDisplay
                  title=""
                  buttonName={"Stake"}
                  pageSize={6}
                  nfts={walletNFTs}
                  onButtonClick={stakeV2}
                  refreshCounter={refreshCounter}
                  nothingMessage={
                    <div>
                      No RandomWalkNFT, Spirals or Crystals.{" "}
                      <Link to="/spirals" style={{ color: "#ffd454" }}>
                        Mint some to stake
                      </Link>
                    </div>
                  }
                />
              </Col>
              <Col md={6} style={{ border: "solid 1px white", paddingRight: "20px", paddingLeft: "20px" }}>
                <h2
                  style={{
                    textAlign: "center",
                    backgroundColor: "rgba(0, 0, 0, 0.5)",
                    padding: "10px",
                    color: "#ffd454",
                  }}
                >
                  Staked NFTs
                </h2>

                <StakingPageDisplay
                  title=""
                  buttonName="Unstake"
                  pageSize={6}
                  nfts={stakedNFTCards}
                  onButtonClick={unstakeV2}
                  refreshCounter={refreshCounter}
                  nothingMessage={<div>Nothing staked here</div>}
                />
              </Col>
            </Row>
            <Row>
              <Col md={6} style={{ border: "solid 1px white", paddingRight: "20px", paddingLeft: "20px" }}>
                <h2
                  style={{
                    textAlign: "center",
                    backgroundColor: "rgba(0, 0, 0, 0.5)",
                    padding: "10px",
                    color: "#ffd454",
                  }}
                >
                  Crystals Growing
                </h2>
                <StakingPageDisplay
                  title=""
                  buttonName="Unstake"
                  pageSize={6}
                  nfts={growingCrystalNFTCards}
                  onButtonClick={unstakeV2}
                  secondButtonName="Harvest All"
                  onSecondButtonClick={harvest}
                  refreshCounter={refreshCounter}
                  nothingMessage={<div>No Crystals growing</div>}
                />
              </Col>
              <Col md={6} style={{ border: "solid 1px white", paddingRight: "20px", paddingLeft: "20px" }}>
                <h2
                  style={{
                    textAlign: "center",
                    backgroundColor: "rgba(0, 0, 0, 0.5)",
                    padding: "10px",
                    color: "#ffd454",
                  }}
                >
                  Rewards
                </h2>
                <Table variant="dark">
                  <tbody>
                    <tr>
                      <td style={{ textAlign: "left" }}>Earned</td>
                      <td style={{ textAlign: "right" }}>{formatkmb(spiralBitsPendingReward)} SPIRALBITS</td>
                    </tr>
                    <tr>
                      <td style={{ textAlign: "left" }}>Crystals Growing</td>
                      <td style={{ textAlign: "right" }}>{growingCrystalNFTCards?.length}</td>
                    </tr>
                    <tr>
                      <td style={{ textAlign: "left" }}>Absorbed by Crystals</td>
                      <td style={{ textAlign: "right" }}>
                        {formatkmb(spiralBitsPendingReward?.sub(spiralBitsLeftAfterGrowing || BigNumber.from(0)))}{" "}
                        SPIRALBITS
                      </td>
                    </tr>
                    {v1RewardsPending.gt(0) && (
                      <tr>
                      <td style={{ textAlign: "left" }}>Staking V1 Rewards</td>
                      <td style={{ textAlign: "right" }}>{formatkmb(v1RewardsPending)} SPIRALBITS</td>
                    </tr>
                    )}
                  </tbody>
                </Table>
                <Row>
                  <div style={{ display: "flex", justifyContent: "end", padding: "10px", gap: "10px" }}>
                    <OverlayTrigger placement="top" overlay={<Tooltip>{"Withdraw all SPIRALBITS"}</Tooltip>}>
                      <Button variant="info" onClick={withdrawRewards}>
                        Withdraw All Rewards
                      </Button>
                    </OverlayTrigger>
                  </div>
                </Row>
              </Col>
            </Row>
            {v1StakedNFTs && v1StakedNFTs.length > 0 && (
              <Row>
                <Col md={12} style={{ border: "solid 1px white", paddingRight: "20px", paddingLeft: "20px" }}>
                  <StakingPageDisplay
                    title="V1 Staked"
                    buttonName="Unstake All"
                    pageSize={12}
                    nfts={v1StakedNFTs}
                    onButtonClick={unstakeV1}
                    refreshCounter={refreshCounter}
                    nothingMessage={<div>Nothing staked in V1.</div>}
                  />
                </Col>
              </Row>
            )}
          </>
        )}
        {!props.selectedAddress && (
          <div style={{ marginTop: "50px", marginBottom: "100px" }}>
            <div>
              Connect your Metamask wallet
              <br />
              to start staking Spirals and RandomWalkNFTs
            </div>
            <a href="#faq" className="mb-5" style={{ color: "#ffc106" }}>
              What is Spiral Staking?
            </a>
            <br />
            <Button className="connect mt-4" variant="warning" onClick={props.connectWallet}>
              Connect Wallet
            </Button>
          </div>
        )}
      </div>

      <a id="faq"></a>
      <Row className="mb-5 mt-5" style={{ textAlign: "center", backgroundColor: "#222", padding: "20px" }}>
        <h1>Staking FAQ</h1>
      </Row>
      <Row className="justify-content-md-center">
        <Col md={8}>
          <div className="mb-3">
            <span style={{ fontWeight: "bold", color: "#ffd454" }}>How does the Staking work?</span>
            <br />
            "Chapter 2: The SpiralBits" lets you stake your Impish NFTs and tokens to earn SPIRALBITS tokens. The
            currently supported NFTs and Tokens are:
            <ul>
              <li>RandomWalk NFT</li>
              <li>Impish Spiral</li>
              <li>Impish Crystals</li>
              <li>IMPISH tokens</li>
              <li>SPIRALBITS tokens</li>
            </ul>
            Staking is the process of depositing your NFTs and tokens into a staking contract, and earning a stream of
            SPIRALBITS tokens for the duration that the NFTs are kept in the staking contracts.
            <br />
            <br />
            SPIRALBITS is an ERC-20 token on Arbitrum, and the currency that will be used throughout the rest of the
            Impish Chapters.
            <br />
            <br />
            Staking your NFTs and tokens earns you SPIRALBITS at the following rates:
            <ul>
              <li>RandomWalkNFT earns you 1 SPIRALBITS per minute, or 1.4K SPIRALBITS per day plus bonuses.</li>
              <li>Impish Spiral earns you a 10 SPIRALBITS per minute or 14.4K SPIRALBITS per day plus bonuses.</li>
              <li>Staking a fully grown crystal earns you 7,2K SPIRALBITS per day.</li>
              <li>
                All Staked SPIRALBITS earn 4 SPIRALBITS per second, and you will earn a part of this in proportion to
                how many SPIRALBITS you have staked
              </li>
              <li>
                All Staked IMPISH earn 1 SPIRALBITS per second, and you will earn a part of this in proportion to how
                many IMPISH you have staked
              </li>
            </ul>
            You can stake, unstake and/or withdraw your accumulated SPIRALBITS at any time, there are no lockins.
            However, note that if you have any Crystals that are growing, you might want to harvest them first, allowing
            them to grow to full size.
          </div>

          <div className="mb-3">
            <span style={{ fontWeight: "bold", color: "#ffd454" }}>How do I grow my Crystals?</span>
            <br />
            If you stake a Impish Crystal that is not fully grown yet (i.e., not size 100), then it will automatically
            absorb SPIRALBITS rewards earned by the other NFTs and tokens you have staked and grow.
            <br />
            After the Crystal has grown to full size, you may "Harvest" it, turning it into a fully grown Crystal. Fully
            grown Crystals will then start earning Staking rewards themselves
            <br />
            <br />
            Of course, you can unstake any NFT or Token at any time - There are no lockins.
          </div>

          <div className="mb-3">
            <span style={{ fontWeight: "bold", color: "#ffd454" }}>How can I buy SPIRABITS?</span>
            <br />
            Apart from Staking, you can also buy SPIRALBITS tokens on{" "}
            <a
              href="https://app.uniswap.org/#/swap?inputCurrency=ETH&outputCurrency=0x650A9960673688Ba924615a2D28c39A8E015fB19"
              target="_blank"
              rel="noreferrer"
              style={{ color: "white" }}
            >
              Uniswap
            </a>{" "}
            on Arbitrum.
          </div>

          <div className="mb-3">
            <span style={{ fontWeight: "bold", color: "#ffd454" }}>How many SPIRALBITS tokens will be issued?</span>
            <br />
            There will only be 2 Billion SPIRALBITS tokens.
            <br />
            <br />
            <ul>
              <li>100M tokens(5%) will be minted at start and put into a Uniswap V3 liquidity pool on Arbitrum</li>
              <li>~14k tokens per day will be issued per Staked Impish Spiral</li>
              <li>~1.4k tokens per day will be issued per Staked RandomWalkNFT</li>
              <li>
                Staking of SPIRALBITS itself will be enabled in the coming days, allowing you to compound your
                SPIRALBITS
              </li>
            </ul>
          </div>

          <div className="mb-3">
            <span style={{ fontWeight: "bold", color: "#ffd454" }}>What happens to my Spirals and RandomWalkNFTs staked in the previous contract?</span>
            <br />
            Your previously staked RandomWalkNFTs and Spirals are available under the "Staked in V1" section. While these are still earning SPIRALBITS, they
            don't help your Crystals grow automatically, so you should consider unstaking them from V1 and re-staking them into the
            new staking interface.
            <br />
            <br />
          </div>

          <div className="mb-3">
            <span style={{ fontWeight: "bold", color: "#ffd454" }}>What utility do SPIRALBITS have?</span>
            <br />
            SPIRALBITS are the utility token for the rest of the Impish Chapters. All details will be released 2nd week
            of Jan, but here's a sneak preview:
            <ul>
              <li>Impish Spiral + SPIRALBITS ==&gt; create an Impish Crystal </li>
              <li>Impish Crystal + SPIRALBITS ==&gt; grow your Crystal </li>
              <li>Impish Crystal ==shatter crystal==&gt; recover SPIRALBITS contained in the Crystal</li>
            </ul>
          </div>

          <div className="mb-3">
            <span style={{ fontWeight: "bold", color: "#ffd454" }}>Where are the contracts Deployed?</span>
            <br />
            SPIRALBITS is deployed as a normal ERC-20 token at &nbsp;
            <a
              href="https://arbiscan.io/address/0x650a9960673688ba924615a2d28c39a8e015fb19#code"
              rel="noreferrer"
              target="_blank"
              style={{ color: "white" }}
            >
              0x650A9960673688Ba924615a2D28c39A8E015fB19
            </a>
            &nbsp;
            <br />
            The Staking contracts for &nbsp;
            <a
              href="https://arbiscan.io/address/0x2069cB988d5B17Bab70d73076d6F1a9757A4f963#code"
              rel="noreferrer"
              target="_blank"
              style={{ color: "white" }}
            >
              ImpishSpirals
            </a>{" "}
            &nbsp; and &nbsp;
            <a
              href="https://arbiscan.io/address/0xd9403e7497051b317cf1ae88eeaf46ee4e8ead68#code"
              rel="noreferrer"
              target="_blank"
              style={{ color: "white" }}
            >
              RandomWalkNFTs
            </a>{" "}
            &nbsp; are also deployed and verified on arbiscan.
          </div>
        </Col>
      </Row>
    </>
  );
}
