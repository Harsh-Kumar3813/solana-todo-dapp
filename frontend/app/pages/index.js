import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { useTodo } from '../hooks/todo';
import Loading from '../components/Loading';
import TodoSection from '../components/todo/TodoSection';
import styles from '../styles/Home.module.css';
import { useEffect, useState } from 'react';

const Home = () => {
    const {
        initialized,
        initializeUser,
        loading,
        transactionPending,
        todos,
        input,
        setInput,
        addTodo,
        markTodo,
    } = useTodo();
    
    const [clientInitialized, setClientInitialized] = useState(false);

    useEffect(() => {
        // Setting client initialized to true after first render
        setClientInitialized(true);
    }, []);

    // Avoid rendering server-only content on the client-side
    if (!clientInitialized) {
        return null;
    }

    return (
        <div className={styles.container}>
            <div className={styles.actionsContainer}>
                {initialized ? (
                    <div className={styles.todoInput}>
                        <form onSubmit={addTodo}>
                            <input
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                id={styles.inputField}
                                type="text"
                                placeholder='Create a new todo...'
                            />
                            <button type="submit" disabled={transactionPending}>
                                Add
                            </button>
                        </form>
                    </div>
                ) : (
                    <button type="button" className={styles.button} onClick={initializeUser} disabled={transactionPending}>
                        Initialize
                    </button>
                )}
                <WalletMultiButton />
            </div>

            <div className={styles.mainContainer}>
                <Loading loading={loading}>
                    <TodoSection title="Tasks" todos={todos.filter(todo => !todo.completed)} action={markTodo} />
                    <TodoSection title="Completed" todos={todos.filter(todo => todo.completed)} action={markTodo} />
                </Loading>
            </div>
        </div>
    );
};

export default Home;
