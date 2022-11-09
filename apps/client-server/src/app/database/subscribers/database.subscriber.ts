import {
  ChangeSet,
  ChangeSetType,
  EventSubscriber,
  FlushEventArgs,
  Subscriber,
} from '@mikro-orm/core';
import { Injectable } from '@nestjs/common';
import { Constructor } from 'type-fest';
import { v4 } from 'uuid';
import { BaseEntity } from '../entities/base.entity';

export type EntityUpdateRecord<T = BaseEntity> = [ChangeSetType, T];
export type OnDatabaseUpdateCallback<T = BaseEntity> = (
  updates: EntityUpdateRecord<T>[]
) => void;

const registeredListeners: Map<
  Constructor<BaseEntity>,
  OnDatabaseUpdateCallback[]
> = new Map();

/**
 * Service that subscribes to updates that occurs in the database
 * the emits events to listeners (for emits and other reactive events).
 *
 * @class DatabaseUpdateSubscriber
 * @implements {EventSubscriber<BaseEntity>}
 */
@Subscriber()
@Injectable()
export class DatabaseUpdateSubscriber implements EventSubscriber<BaseEntity> {
  private id = v4();

  async afterFlush(event: FlushEventArgs): Promise<void> {
    this.publish(event.uow.getChangeSets() as ChangeSet<BaseEntity>[]);
  }

  /**
   * Subscribe a callback function to a list of entities.
   *
   * @param {Constructor<BaseEntity>[]} entities
   * @param {OnDatabaseUpdateCallback} func
   */
  public subscribe(
    entities: Constructor<BaseEntity>[],
    func: OnDatabaseUpdateCallback
  ): void {
    entities.forEach((entity) => {
      if (!registeredListeners.has(entity)) {
        registeredListeners.set(entity, []);
      }

      registeredListeners.set(entity, [
        ...registeredListeners.get(entity),
        func,
      ]);
    });
  }

  /**
   * Publishes updates to the database to registered callbacks.
   *
   * @param {ChangeSet<BaseEntity>[]} changeSet
   */
  private publish(changeSet: ChangeSet<BaseEntity>[]) {
    const callbacks: Map<OnDatabaseUpdateCallback, EntityUpdateRecord[]> =
      new Map();
    changeSet.forEach((change) => {
      // Retrieve any callbacks registered
      const proto = Object.getPrototypeOf(change.entity);
      if (registeredListeners.has(proto.constructor)) {
        registeredListeners.get(proto.constructor).forEach((cb) => {
          // Filter duplicates out since an callback can be put on multiple entities
          if (!callbacks.get(cb)) {
            callbacks.set(cb, []);
          }

          callbacks.set(cb, [
            ...callbacks.get(cb),
            [change.type, change.entity],
          ]);
        });
      }
    });

    callbacks.forEach((value, cb) => {
      cb(value);
    });
  }
}