import * as anchor from '@project-serum/anchor';
import { useEffect, useMemo, useState } from 'react';
import { TODO_PROGRAM_PUBKEY } from '../constants/index';
import { IDL as profileIdl } from '../constants/idl';
import toast from 'react-hot-toast';
import { SystemProgram, PublicKey, Connection } from '@solana/web3.js';  // Import Connection
import { useAnchorWallet, useWallet } from '@solana/wallet-adapter-react';
import { authorFilter } from '../utils';

// Create a custom connection
const connection = new Connection('https://api.devnet.solana.com', 'confirmed');  // Define your custom connection

export function useTodo() {
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
                        [new TextEncoder().encode('USER_STATE'), publicKey.toBuffer()],
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

    const initializeUser = async () => {
        if (program && publicKey) {
            try {
                setTransactionPending(true);
                const [profilePda] = PublicKey.findProgramAddressSync(
                    [new TextEncoder().encode('USER_STATE'), publicKey.toBuffer()],
                    program.programId
                );

                await program.methods.initializeUser().accounts({
                    userProfile: profilePda,
                    authority: publicKey,
                    systemProgram: SystemProgram.programId,
                }).rpc();
                setInitialized(true);
                toast.success('Successfully initialized user.');
            } catch (error) {
                console.error('Error initializing user:', error);
                toast.error('Failed to initialize user');
            } finally {
                setTransactionPending(false);
            }
        }
    };

    const addTodo = async (e) => {
        e.preventDefault();
        if (program && publicKey) {
            try {
                setTransactionPending(true);
    
                // Fetch the latest blockhash
                const latestBlockhash = await connection.getLatestBlockhash();
                
                const [profilePda] = PublicKey.findProgramAddressSync(
                    [new TextEncoder().encode('USER_STATE'), publicKey.toBuffer()],
                    program.programId
                );
    
                const content = input;
                if (!content) return;
    
                const [todoPda] = PublicKey.findProgramAddressSync(
                    [new TextEncoder().encode('TODO_STATE'), publicKey.toBuffer(), Uint8Array.from([lastTodo])],
                    program.programId
                );
    
                // Create transaction and add the latest blockhash
                const tx = new anchor.web3.Transaction().add(
                    program.methods.addTodo(content).accounts({
                        todoAccount: todoPda,
                        userProfile: profilePda,
                        authority: publicKey,
                        systemProgram: SystemProgram.programId,
                    }).instruction()
                );
    
                // Assign recent blockhash and fee payer to the transaction
                tx.recentBlockhash = latestBlockhash.blockhash;  // Use the latest blockhash here
                tx.feePayer = publicKey;
    
                // Send and confirm the transaction
                const txSig = await program.provider.sendAndConfirm(tx);
                console.log('Transaction successful with signature:', txSig);
    
                // Update the state
                setLastTodo((prev) => prev + 1);
                setTodos((prevTodos) => [
                    ...prevTodos,
                    { account: { content, marked: false, idx: lastTodo } }
                ]);
                setInput("");
                toast.success('Added new todo.');
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
                const [profilePda] = PublicKey.findProgramAddressSync(
                    [new TextEncoder().encode('USER_STATE'), publicKey.toBuffer()],
                    program.programId
                );

                const [todoPda] = PublicKey.findProgramAddressSync(
                    [new TextEncoder().encode('TODO_STATE'), publicKey.toBuffer(), Uint8Array.from([idx])],
                    program.programId
                );

                await program.methods.markTodo(idx).accounts({
                    todoAccount: todoPda,
                    userProfile: profilePda,
                    authority: publicKey,
                }).rpc();

                const newTodos = todos.map((todo) =>
                    todo.account.idx === idx ? { ...todo, account: { ...todo.account, marked: true } } : todo
                );

                setTodos(newTodos);
                toast.success('Marked todo as done.');
            } catch (error) {
                console.error('Error marking todo:', error);
                toast.error('Failed to mark todo.');
            } finally {
                setTransactionPending(false);
            }
        }
    };

    const removeTodo = async (idx) => {
        if (program && publicKey) {
            try {
                setTransactionPending(true);
                const [profilePda] = PublicKey.findProgramAddressSync(
                    [new TextEncoder().encode('USER_STATE'), publicKey.toBuffer()],
                    program.programId
                );

                const [todoPda] = PublicKey.findProgramAddressSync(
                    [new TextEncoder().encode('TODO_STATE'), publicKey.toBuffer(), Uint8Array.from([idx])],
                    program.programId
                );

                await program.methods.removeTodo(idx).accounts({
                    todoAccount: todoPda,
                    userProfile: profilePda,
                    authority: publicKey,
                }).rpc();

                const newTodos = todos.filter((todo) => todo.account.idx !== idx);
                setTodos(newTodos);
                toast.success('Todo removed.');
            } catch (error) {
                console.error('Error removing todo:', error);
                toast.error('Failed to remove todo.');
            } finally {
                setTransactionPending(false);
            }
        }
    };

    return {
        initialized,
        initializeUser,
        todos,
        loading,
        addTodo,
        markTodo,
        removeTodo,
        input,
        setInput,
    };
}
