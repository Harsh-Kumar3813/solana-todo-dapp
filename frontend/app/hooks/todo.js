import * as anchor from '@project-serum/anchor';
import { useEffect, useMemo, useState } from 'react';
import { TODO_PROGRAM_PUBKEY } from '../constants/index';
import { IDL as profileIdl } from '../constants/idl';
import { SystemProgram, PublicKey } from '@solana/web3.js';
import { useAnchorWallet, useConnection, useWallet } from '@solana/wallet-adapter-react';
import { authorFilter } from '../utils/index';
import toast from 'react-hot-toast';

export function useTodo() {
    const { connection } = useConnection();
    const { publicKey } = useWallet();
    const anchorWallet = useAnchorWallet();

    const [initialized, setInitialized] = useState(false);
    const [lastTodo, setLastTodo] = useState(0);
    const [todos, setTodos] = useState([]);
    const [loading, setLoading] = useState(false);
    const [transactionPending, setTransactionPending] = useState(false);
    const [input, setInput] = useState("");

    const program = useMemo(() => {
        if (anchorWallet) {
            const provider = new anchor.AnchorProvider(connection, anchorWallet, anchor.AnchorProvider.defaultOptions());
            return new anchor.Program(profileIdl, TODO_PROGRAM_PUBKEY, provider);
        }
    }, [connection, anchorWallet]);

    useEffect(() => {
        const findProfileAccounts = async () => {
            if (program && publicKey && !transactionPending) {
                try {
                    setLoading(true);
                    const [profilePda] = PublicKey.findProgramAddressSync(
                        [Buffer.from('USER_STATE'), publicKey.toBuffer()],
                        program.programId
                    );
                    const profileAccount = await program.account.userProfile.fetchNullable(profilePda);

                    if (profileAccount) {
                        setLastTodo(profileAccount.lastTodo);
                        setInitialized(true);

                        const todoAccounts = await program.account.todoAccount.all([authorFilter(publicKey.toString())]);
                        setTodos(todoAccounts);
                    } else {
                        setInitialized(false);
                    }
                } catch (error) {
                    console.error('Error fetching profile accounts:', error);
                    setInitialized(false);
                    setTodos([]);
                } finally {
                    setLoading(false);
                }
            }
        };

        findProfileAccounts();
    }, [publicKey, program, transactionPending]);

    const fetchTodos = async () => {
        try {
            if (program && publicKey) {
                const todoAccounts = await program.account.todoAccount.all([authorFilter(publicKey.toString())]);
                return todoAccounts;
            }
            return [];
        } catch (error) {
            console.error('Error fetching todos:', error);
            return [];
        }
    };

    const initializeUser = async () => {
        if (program && publicKey) {
            try {
                const latestBlockhashInfo = await connection.getLatestBlockhash();
                const { blockhash } = latestBlockhashInfo;
    
                const [profilePda] = PublicKey.findProgramAddressSync(
                    [Buffer.from('USER_STATE'), publicKey.toBuffer()],
                    program.programId
                );
    
                // Check if the userProfile is already initialized
                const userProfileAccount = await program.account.userProfile.fetchNullable(profilePda);
                if (userProfileAccount) {
                    console.log("UserProfile is already initialized.");
                    return profilePda;
                }
    
                console.log("Initializing userProfile...");
    
                const initTx = new anchor.web3.Transaction().add(
                    await program.methods.initializeUser().accounts({
                        userProfile: profilePda,
                        authority: publicKey,
                        systemProgram: SystemProgram.programId,
                    }).instruction()
                );
    
                initTx.recentBlockhash = blockhash;
                initTx.feePayer = publicKey;
    
                const txSig = await program.provider.sendAndConfirm(initTx);
                console.log('UserProfile initialized with signature:', txSig);
    
                return profilePda;
            } catch (error) {
                console.error('Error initializing userProfile:', error);
            }
        }
    };
    

    const addTodo = async (e) => {
        e.preventDefault();
        if (program && publicKey) {
            try {
                setTransactionPending(true);
    
                const latestBlockhashInfo = await connection.getLatestBlockhash();
                const { blockhash } = latestBlockhashInfo;
    
                // Check if the user profile exists
                const [profilePda] = PublicKey.findProgramAddressSync(
                    [Buffer.from('USER_STATE'), publicKey.toBuffer()],
                    program.programId
                );
    
                let userProfile;
                try {
                    userProfile = await program.account.userProfile.fetch(profilePda);
                } catch (error) {
                    console.log("User profile not found, initializing...");
    
                    // If not found, initialize the user profile
                    const initTx = new anchor.web3.Transaction().add(
                        await program.methods.initializeUser().accounts({
                            userProfile: profilePda,
                            authority: publicKey,
                            systemProgram: SystemProgram.programId,
                        }).instruction()
                    );
    
                    initTx.recentBlockhash = blockhash;
                    initTx.feePayer = publicKey;
    
                    const initTxSig = await program.provider.sendAndConfirm(initTx);
                    console.log('User profile initialized:', initTxSig);
    
                    // Fetch the user profile again after initialization
                    userProfile = await program.account.userProfile.fetch(profilePda);
                }
    
                const content = input.trim();
                if (!content) {
                    setTransactionPending(false);
                    return;
                }
    
                const lastTodo = userProfile.lastTodo;
                const [todoPda] = PublicKey.findProgramAddressSync(
                    [Buffer.from('TODO_STATE'), publicKey.toBuffer(), Uint8Array.from([lastTodo])],
                    program.programId
                );
    
                const tx = new anchor.web3.Transaction().add(
                    await program.methods.addTodo(content).accounts({
                        todoAccount: todoPda,
                        userProfile: profilePda,
                        authority: publicKey,
                        systemProgram: SystemProgram.programId,
                    }).instruction()
                );
    
                tx.recentBlockhash = blockhash;
                tx.feePayer = publicKey;
    
                const txSig = await program.provider.sendAndConfirm(tx);
                console.log('Todo added successfully with signature:', txSig);
    
                const todoAccounts = await program.account.todoAccount.all([authorFilter(publicKey.toString())]);
                setTodos(todoAccounts);
                setLastTodo((prev) => prev + 1);
                setInput(""); // Clear input
                toast.success('Todo added successfully.');
            } catch (error) {
                console.error('Error adding todo:', error);
                toast.error(error.toString());
            } finally {
                setTransactionPending(false);
            }
        }
    };
    
    
    
    

    const markTodo = async (idx) => {
        if (program && publicKey) {
            try {
                setTransactionPending(true);
    
                const latestBlockhashInfo = await connection.getLatestBlockhash();
                const { blockhash } = latestBlockhashInfo;
    
                // Check if the user profile exists
                const [profilePda] = PublicKey.findProgramAddressSync(
                    [Buffer.from('USER_STATE'), publicKey.toBuffer()],
                    program.programId
                );
    
                let userProfile;
                try {
                    userProfile = await program.account.userProfile.fetch(profilePda);
                } catch (error) {
                    console.log("User profile not found, initializing...");
    
                    // Initialize the user profile if not found
                    const initTx = new anchor.web3.Transaction().add(
                        await program.methods.initializeUser().accounts({
                            userProfile: profilePda,
                            authority: publicKey,
                            systemProgram: SystemProgram.programId,
                        }).instruction()
                    );
    
                    initTx.recentBlockhash = blockhash;
                    initTx.feePayer = publicKey;
    
                    const initTxSig = await program.provider.sendAndConfirm(initTx);
                    console.log('User profile initialized:', initTxSig);
    
                    // Fetch the user profile again after initialization
                    userProfile = await program.account.userProfile.fetch(profilePda);
                }
    
                // Fetch the todo account
                const [todoPda] = PublicKey.findProgramAddressSync(
                    [Buffer.from('TODO_STATE'), publicKey.toBuffer(), Uint8Array.from([idx])],
                    program.programId
                );
    
                let todoAccount;
                try {
                    todoAccount = await program.account.todoAccount.fetch(todoPda);
                    console.log('Todo account fetched:', todoAccount);
                } catch (error) {
                    console.error('Error fetching todo account:', error);
                    if (error.message.includes('Account does not exist')) {
                        toast.error('Todo account does not exist.');
                        return;
                    }
                    throw error;
                }
    
                // Check if the todo is already marked
                if (todoAccount.marked) {
                    toast.error('This todo is already marked.');
                    return;
                }
    
                // Mark the todo on the blockchain
                const tx = new anchor.web3.Transaction().add(
                    await program.methods.markTodo(idx).accounts({
                        todoAccount: todoPda,
                        userProfile: profilePda,
                        authority: publicKey,
                    }).instruction()
                );
    
                tx.recentBlockhash = blockhash;
                tx.feePayer = publicKey;
    
                const txSig = await program.provider.sendAndConfirm(tx);
                console.log('Todo marked successfully with signature:', txSig);
    
                // Update local state
                const newTodos = todos.map((todo) =>
                    todo.account.idx === idx ? { ...todo, account: { ...todo.account, marked: true } } : todo
                );
                setTodos(newTodos);
                toast.success('Todo marked successfully.');
            } catch (error) {
                console.error('Error marking todo:', error);
                toast.error(error.toString());
            } finally {
                setTransactionPending(false);
            }
        }
    };
    
    
    
    

    const removeTodo = async (idx) => {
        if (program && publicKey) {
            try {
                setTransactionPending(true);
                
                // Generate PDA (Program Derived Addresses) for profile and todo account
                const [profilePda] = PublicKey.findProgramAddressSync(
                    [Buffer.from('USER_STATE'), publicKey.toBuffer()],
                    program.programId
                );
    
                const [todoPda] = PublicKey.findProgramAddressSync(
                    [Buffer.from('TODO_STATE'), publicKey.toBuffer(), Uint8Array.from([idx])],
                    program.programId
                );
    
                // Check if the todo account is initialized
                try {
                    await program.account.todoAccount.fetch(todoPda);
                } catch (error) {
                    if (error.message.includes('Account does not exist') || error.message.includes('AccountNotInitialized')) {
                        toast.error('Todo account is not initialized.');
                        return;
                    }
                    throw error;
                }
    
                // Remove the todo
                await program.methods.removeTodo(idx).accounts({
                    todoAccount: todoPda,
                    userProfile: profilePda,
                    authority: publicKey,
                }).rpc();
    
                // Update local todos state after removal
                const newTodos = todos.filter((todo) => todo.account.idx !== idx);
                setTodos(newTodos);
    
                toast.success('Successfully removed todo.');
            } catch (error) {
                console.error('Error removing todo:', error);
                toast.error(error.toString());
            } finally {
                setTransactionPending(false);
            }
        }
    };
    
    

    const incompleteTodos = useMemo(() => todos.filter((todo) => !todo.account.marked), [todos]);
    const completedTodos = useMemo(() => todos.filter((todo) => todo.account.marked), [todos]);

    return {
        initialized,
        fetchTodos, // Expose fetchTodos function
        initializeUser,
        loading,
        transactionPending,
        todos,
        addTodo,
        markTodo,
        removeTodo,
        input,
        setInput,
    };
}
