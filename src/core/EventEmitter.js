/**
 * EventEmitter.js
 * Custom Event Emitter for Module Communication
 *
 * Provides a simple pub/sub pattern for loose coupling
 * between different parts of the application.
 */

/**
 * @class EventEmitter
 * @description Simple event emitter for pub/sub communication pattern
 */
class EventEmitter {
    constructor() {
        /** @type {Map<string, Set<Function>>} Event listeners storage */
        this.listeners = new Map();
    }

    /**
     * Subscribe to an event
     * @param {string} event - Event name
     * @param {Function} callback - Callback function
     * @returns {Function} Unsubscribe function
     */
    on(event, callback) {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, new Set());
        }
        this.listeners.get(event).add(callback);

        // Return unsubscribe function
        return () => this.off(event, callback);
    }

    /**
     * Subscribe to an event only once
     * @param {string} event - Event name
     * @param {Function} callback - Callback function
     */
    once(event, callback) {
        const onceCallback = (...args) => {
            callback(...args);
            this.off(event, onceCallback);
        };
        this.on(event, onceCallback);
    }

    /**
     * Unsubscribe from an event
     * @param {string} event - Event name
     * @param {Function} callback - Callback function to remove
     */
    off(event, callback) {
        if (this.listeners.has(event)) {
            this.listeners.get(event).delete(callback);
        }
    }

    /**
     * Emit an event with data
     * @param {string} event - Event name
     * @param {...*} args - Arguments to pass to callbacks
     */
    emit(event, ...args) {
        if (this.listeners.has(event)) {
            this.listeners.get(event).forEach(callback => {
                try {
                    callback(...args);
                } catch (error) {
                    console.error(`[EventEmitter] Error in callback for "${event}":`, error);
                }
            });
        }
    }

    /**
     * Remove all listeners for an event or all events
     * @param {string} [event] - Event name (optional, clears all if not provided)
     */
    removeAllListeners(event) {
        if (event) {
            this.listeners.delete(event);
        } else {
            this.listeners.clear();
        }
    }

    /**
     * Get listener count for an event
     * @param {string} event - Event name
     * @returns {number}
     */
    listenerCount(event) {
        return this.listeners.has(event) ? this.listeners.get(event).size : 0;
    }
}

export { EventEmitter };
export default EventEmitter;
