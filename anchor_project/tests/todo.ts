import * as anchor from "@project-serum/anchor";
import { Program } from "@project-serum/anchor";
import { CleverTodo } from "../target/types/clever_todo";
import { expect } from "chai";

describe("clever_todo", () => {
  const provider = anchor.AnchorProvider.local();
  anchor.setProvider(provider);
  const program = anchor.workspace.CleverTodo as Program<CleverTodo>;

  let userKeypair: anchor.web3.Keypair;
  let userProfilePDA: anchor.web3.PublicKey;
  let userBump: number;
  let todoPDA: anchor.web3.PublicKey;
  let todoBump: number;

  before(async () => {
    userKeypair = anchor.web3.Keypair.generate();

    [userProfilePDA, userBump] = await anchor.web3.PublicKey.findProgramAddress(
      [Buffer.from("USER_STATE"), userKeypair.publicKey.toBuffer()],
      program.programId
    );

    // Airdrop some SOL to the user keypair for testing
    const airdropSignature = await provider.connection.requestAirdrop(
      userKeypair.publicKey,
      anchor.web3.LAMPORTS_PER_SOL
    );
    await provider.connection.confirmTransaction(airdropSignature);
  });

  it("Initializes user profile", async () => {
    await program.methods
      .initializeUser()
      .accounts({
        authority: userKeypair.publicKey,
        userProfile: userProfilePDA,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([userKeypair])
      .rpc();

    const userProfile = await program.account.userProfile.fetch(userProfilePDA);
    expect(userProfile.authority.toBase58()).to.equal(
      userKeypair.publicKey.toBase58()
    );
    expect(userProfile.lastTodo).to.equal(0);
    expect(userProfile.todoCount).to.equal(0);
  });

  it("Fails to initialize user profile twice", async () => {
    try {
      await program.methods
        .initializeUser()
        .accounts({
          authority: userKeypair.publicKey,
          userProfile: userProfilePDA,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([userKeypair])
        .rpc();
      expect.fail("The transaction should have failed");
    } catch (err) {
      expect(err.error.errorCode.code).to.equal("AccountInUse");
    }
  });

  it("Adds a new todo", async () => {
    const todoContent = "Write unit tests";
    [todoPDA, todoBump] = await anchor.web3.PublicKey.findProgramAddress(
      [
        Buffer.from("TODO_STATE"),
        userKeypair.publicKey.toBuffer(),
        Buffer.from([0]),
      ],
      program.programId
    );

    await program.methods
      .addTodo(todoContent)
      .accounts({
        authority: userKeypair.publicKey,
        userProfile: userProfilePDA,
        todoAccount: todoPDA,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([userKeypair])
      .rpc();

    const userProfile = await program.account.userProfile.fetch(userProfilePDA);
    expect(userProfile.todoCount).to.equal(1);

    const todoAccount = await program.account.todoAccount.fetch(todoPDA);
    expect(todoAccount.content).to.equal(todoContent);
    expect(todoAccount.marked).to.be.false;
  });

  it("Marks a todo as done", async () => {
    await program.methods
      .markTodo(0)
      .accounts({
        authority: userKeypair.publicKey,
        userProfile: userProfilePDA,
        todoAccount: todoPDA,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([userKeypair])
      .rpc();

    const todoAccount = await program.account.todoAccount.fetch(todoPDA);
    expect(todoAccount.marked).to.be.true;
  });

  it("Fails to mark a todo that is already marked", async () => {
    try {
      await program.methods
        .markTodo(0)
        .accounts({
          authority: userKeypair.publicKey,
          userProfile: userProfilePDA,
          todoAccount: todoPDA,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([userKeypair])
        .rpc();
      expect.fail("The transaction should have failed");
    } catch (err) {
      expect(err.error.errorCode.code).to.equal("AlreadyMarked");
    }
  });

  it("Removes a todo", async () => {
    await program.methods
      .removeTodo(0)
      .accounts({
        authority: userKeypair.publicKey,
        userProfile: userProfilePDA,
        todoAccount: todoPDA,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([userKeypair])
      .rpc();

    const userProfile = await program.account.userProfile.fetch(userProfilePDA);
    expect(userProfile.todoCount).to.equal(0);
  });

  it("Fails to remove a non-existent todo", async () => {
    try {
      // Generate PDA for a non-existent todo (index 1)
      const [nonExistentTodoPDA] =
        await anchor.web3.PublicKey.findProgramAddress(
          [
            Buffer.from("TODO_STATE"),
            userKeypair.publicKey.toBuffer(),
            Buffer.from([1]),
          ],
          program.programId
        );

      await program.methods
        .removeTodo(1)
        .accounts({
          authority: userKeypair.publicKey,
          userProfile: userProfilePDA,
          todoAccount: nonExistentTodoPDA,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([userKeypair])
        .rpc();
      expect.fail("The transaction should have failed");
    } catch (err) {
      expect(err.message).to.contain("Error: Account does not exist");
    }
  });
});
