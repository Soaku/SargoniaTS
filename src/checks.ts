import Context from "./Context";
import { InternalRedirect } from "./exceptions";
import User from "./User";
import Character from "./Character";
import Event from "./events/Event";

export type UserContext = Context & { user: User; };
export type CharacterContext = Context & { user: User & { currentCharacter: Character; }; };
export type ExclusiveContext<T extends Event> = CharacterContext & {
    user: User & {
        currentCharacter: Character
        & { event: T | undefined; };
    };
};

// Let's hope one day it will be possible to convert this to decorator.

/**
 * Wrap the given function, so that it won't execute if the typeguard fails.
 */
export default function checkContext<T extends Context>(
    wrapper: (context: Context) => context is T,
    func: (context: T) => any
) {

    return (context: Context) => {

        // Check the context
        if (wrapper(context)) {

            // Run the function
            return func(context);

        }

    };

}

export function requireLogin(context: Context): context is UserContext {

    // If not logged in
    if (!context.user) {

        // Redirect to login
        throw new InternalRedirect("/login", context);

    }

    return true;

}

export function requireCharacter(context: Context): context is CharacterContext {

    // Check for login first
    requireLogin(context);

    // If no character is chosen
    if (!context.user!.currentCharacter) {

        throw new InternalRedirect("/character/select", context);

    }

    return true;

}

// Just for a better look
type Constructor<T> = new (...a: any[]) => T;

/**
 * This function checks whether a character is assigned and whether if they're participating in a different kind
 * of event. It will allow characters with no events assigned though
 *
 * @param redirect Redirect to the primary event instead of giving a stop/return prompt.
 */
export function exclusiveEvent<T extends Event>(context: Context, event: Constructor<T>, redirect?: boolean):
    context is ExclusiveContext<T>;
export function exclusiveEvent<T extends Event>(event: Constructor<T>, redirect?: boolean):
    (context: Context) => context is ExclusiveContext<T>;
export function exclusiveEvent<T extends Event>(context: Context | Constructor<T>, event?: Constructor<T> | boolean,
    redirect = false) {

    // Supplied the redirect, 1-2 argument signature
    if (typeof event === "boolean") {

        // The event is actually the redirect
        redirect = event;

        // The context is actually the event
        event = <Constructor<T>>context;

    }

    // Other signatures
    else {

        // Get the event
        event = event || <Constructor<T>>context;

    }

    // Create the function
    const f = (context: Context) => {

        requireCharacter(context);

        let currentEvent = context.user!.currentCharacter!.event;

        // No event assigned
        if (currentEvent === undefined) {

            // Pass the test
            return true;

        }

        // If they have the correct event assigned
        if (currentEvent instanceof <Constructor<T>>event) {

            // Pass the test
            return true;

        }

        // Requested a redirect instead
        if (redirect) {

            throw new InternalRedirect("/" + currentEvent.primaryAction, context);

        }

        // Show an error
        context.error = context.language.busy(currentEvent.status(context.language));

        // Add actions
        let actions: Common.ActionLink[] = [];
        context.actions.push(actions);

        // Get the status
        let status = currentEvent.status(context.language);

        // An option to quit the event
        if (currentEvent.leave) {

            // Add an option with a link to quit the event
            actions.push({

                text: context.language.simple.endItNow,
                url: "/stop/then/" + context.url[0]

            });

        }

        // Add a new
        actions.push({

            text: context.language.return(status),
            url: "/" + currentEvent.primaryAction,

        });

        return false;

    };

    // If no context was given (context is an event)
    if (context instanceof Function) {

        // Return the function
        return f;

    }

    // Execute the function
    return f(context);

}
