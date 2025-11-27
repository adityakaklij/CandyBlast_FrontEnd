import React from 'react';
import { ConnectButton, useCurrentAccount, useSuiClientQuery, useSignAndExecuteTransaction, useSuiClient, SuiClientProvider } from '@mysten/dapp-kit';
import { Transaction } from "@mysten/sui/transactions";
import { useWallets } from '@mysten/dapp-kit';
import { SuiClient, getFullnodeUrl } from '@mysten/sui/client';
// import { ConnectButton, useCurrentAccount, useSuiClientQuery, useSignAndExecuteTransaction, useSuiClient, SuiClientProvider } from '@onelabs/dapp-kit';
// import { Transaction } from '@onelabs/sui/transactions';
// import { useWallets } from '@onelabs/dapp-kit';
// import { SuiClient, getFullnodeUrl } from '@onelabs/sui/client';

const Test = () => {
  const account = useCurrentAccount();  

  const { data, isLoading } = useSuiClientQuery(
    'getOwnedObjects',
    account ? { owner: account.address } : undefined,
    { enabled: !!account } // optional: only run when account exists
  );


  const { mutate: signAndExecute, isPending, isSuccess, reset } = useSignAndExecuteTransaction();
  const suiClient = new SuiClient({ url: "https://rpc-testnet.onelabs.cc:443" });
  // const suiClient = new SuiClient({ url: "https://fullnode.testnet.sui.io:443" });
  // const suiClient = useSuiClient();
  
  const testMint =async () => {
    let p = await suiClient.getLatestCheckpointSequenceNumber()
    console.log("Latest Checkpoint Sequence Number:", p);
    
    const nftCount = await suiClient.getObject({ id: "0xbb9d4d95bbbefb875faa7cb3f5426b70563208b3e8f819a452c03ec6e9251e2d" });
    console.log("NFT Count:", nftCount);
    
    const tx = new Transaction();
    const packageId = "0x39d54495b01e088be4880a48ae43d833d4b5a6da19233830f28980e244676fc0"; //  Contract Address
    const NFT_URL="https://cdn.prod.website-files.com/65217fd9e31608b8b68141ba/65217fd9e31608b8b68144d3_8H6W1rnSV19LArfV6KnqgL96-O-9qAcxAg70kUgKiw9Sl0CPmPmmY9MycIAFHcFZIfwiri7ieakPKC-l8ltYyZ5t0Mw91hYgNVuhYxGO5f7jq2BVI5P4RYwiJwB_JtQYqMhwEPLq77MwTKIogN96qy1y_Q%3Ds2048.png"
    tx.moveCall({
      package: packageId,
      module: "LandRegistry",
      function: "mint_nft",
      arguments: [
        tx.pure.u16(13),
        tx.pure.u16(99),
        tx.pure.string(NFT_URL),
        tx.sharedObjectRef({
          objectId: "0xb9283b2ead39ecbfff16e116e37f2d5f669453b0d81aceb30f4f8ecf00f000d9",        // nftCount
          mutable: false,                  // read-only ref (&)
          initialSharedVersion: 104, // ONELABS
        }),
        tx.sharedObjectRef({
          objectId: "0xddd054120a841871d61c5fe961c64bad3f60f5982da5de61ae32a8943649d8e6",        // registry
          mutable: true,                   // &mut
          initialSharedVersion: 104, // ONELABS
        }),
        tx.sharedObjectRef({
          objectId: "0x370421225986730fe40ca94e25d7da58825317bab224c7b8f869d0a584d1b5b2",       // landRegistryAddress
          mutable: true,                   // &mut
          initialSharedVersion: 104, // ONELABS
        }),
      ],
    });

console.log("Processing Transaction");
    signAndExecute({
      transaction: tx as any
    }, {
      onError: (e) => {
        console.log("Tx Failed! from here");
        console.log(e);
      },
      onSuccess: async ({ digest }) => {
        let p = await suiClient.waitForTransaction({
          digest,
          options: {
            showEffects: true
          }
        });
        console.log("Transaction Result:", p);
        console.log("tx digest:", digest);


        const eventResult = await suiClient.queryEvents({
          query: { Transaction: digest }
        });
        console.log("Event Result:", eventResult);
        console.log("Event Result:", eventResult.data);

        if (eventResult.data.length > 0) {
          const firstEvent = eventResult.data[0].parsedJson as {proposal_id?: string, voter?: string, vote_yes?: boolean };
          const id = firstEvent.proposal_id || "No event found for give criteria";
          const voter = firstEvent.voter || "No event found for give criteria";
          const voteYes = firstEvent.vote_yes || "No event found for give criteria";
          console.log("Event Captured!");
          console.log(id, voter, voteYes);
        } else {
          console.log("No events found!");
        }

        reset();
        console.log("Tx Succesful!");
      }
    });
  }

 
  const handleClick = () => {
    console.log("Account:", account);
    let userAddress = account?.address;
    console.log("User Address:", userAddress);
    
    console.log("Objects:", data);
  };

  return (
    <>
      <h1>Test</h1>

      <button onClick={handleClick}>Test</button>
      <button onClick={testMint}>Mint</button>

      <ConnectButton />
    </>
  );
};

export default Test;

